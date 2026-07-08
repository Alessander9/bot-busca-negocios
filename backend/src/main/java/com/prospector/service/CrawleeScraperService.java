package com.prospector.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prospector.domain.Lead;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CrawleeScraperService {
  private static final Logger log = LoggerFactory.getLogger(CrawleeScraperService.class);
  private static final Pattern CELL_PROGRESS_PATTERN =
      Pattern.compile("--- CELL_PROGRESS (\\d+)/(\\d+) (\\d+) ---");

  private final ObjectMapper objectMapper;
  private final SearchJobService searchJobService;

  /** Configurable via app.scraper.timeout-seconds in application.properties */
  @Value("${app.scraper.timeout-seconds:240}")
  private int scraperTimeoutSeconds;

  /** Extended timeout for grid searches (default 40 min) */
  @Value("${app.scraper.grid-timeout-seconds:2400}")
  private int gridTimeoutSeconds;

  public CrawleeScraperService(ObjectMapper objectMapper, SearchJobService searchJobService) {
    this.objectMapper = objectMapper;
    this.searchJobService = searchJobService;
  }

  public List<Lead> scrapeGoogleMaps(String category, Double latitude, Double longitude, Integer radiusKm) {
    List<Lead> leads = new ArrayList<>();
    try {
      // Find the workspace root path
      // The parent directory of "backend" is the project root folder
      String userDir = System.getProperty("user.dir");
      File rootDir = new File(userDir).getParentFile();
      File scraperScript = new File(rootDir, "scraper/google_maps_scraper.py");

      if (!scraperScript.exists()) {
        log.error("El script de scraping no existe en: {}", scraperScript.getAbsolutePath());
        throw new IllegalStateException("Script de scraping no encontrado");
      }

      log.info("Iniciando scraping de Google Maps con Crawlee. Script: {}", scraperScript.getAbsolutePath());

      ProcessBuilder pb = new ProcessBuilder(
          "python",
          scraperScript.getAbsolutePath(),
          "--category", category,
          "--latitude", String.valueOf(latitude),
          "--longitude", String.valueOf(longitude),
          "--radius", String.valueOf(radiusKm)
      );

      // Run within the parent directory
      pb.directory(rootDir);
      pb.redirectErrorStream(true);

      Process process = pb.start();

      StringBuilder output = new StringBuilder();
      boolean jsonStarted = false;
      try (BufferedReader reader = new BufferedReader(
          new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
          // Log lines from crawlee to backend console for debugging
          log.info("[Crawlee Scraper] {}", line);
          if (line.trim().equals("--- JSON_START ---")) {
            jsonStarted = true;
            continue;
          }
          if (jsonStarted) {
            output.append(line).append("\n");
          }
        }
      }

      boolean finished = process.waitFor(scraperTimeoutSeconds, java.util.concurrent.TimeUnit.SECONDS);
      if (!finished) {
        log.error("El scraper de Python excedió el tiempo límite de {} segundos y fue terminado.", scraperTimeoutSeconds);
        process.destroyForcibly();
        throw new IllegalStateException("El scraper excedió el tiempo límite de " + scraperTimeoutSeconds + " segundos.");
      }
      int exitCode = process.exitValue();
      log.info("Scraper de Crawlee finalizó con código de salida: {}", exitCode);

      if (exitCode != 0) {
        throw new IllegalStateException("El scraper de Python falló con código " + exitCode);
      }

      String jsonOutput = output.toString().trim();
      if (jsonOutput.isEmpty()) {
        log.warn("El scraper no retornó datos JSON.");
        return leads;
      }

      // Deserialize JSON output to List of Leads
      leads = objectMapper.readValue(jsonOutput, new TypeReference<List<Lead>>() {});
      log.info("Deserializados correctamente {} leads de Google Maps.", leads.size());

    } catch (Exception e) {
      log.error("Error al ejecutar el scraper de Crawlee", e);
      throw new RuntimeException("Error ejecutando el scraper de Google Maps", e);
    }
    return leads;
  }

  /**
   * Runs the scraper in grid mode as a background job.
   * Reads CELL_PROGRESS markers from stdout and updates SearchJobService after each cell.
   * Marks the job DONE or ERROR when the process finishes.
   *
   * @param jobId UUID of the SearchJob to update
   */
  public void scrapeGoogleMapsGrid(UUID jobId, String category, Double latitude, Double longitude, Integer radiusKm, String mode, Boolean aiOptimize) {
    List<Lead> allLeads = new ArrayList<>();
    try {
      String userDir = System.getProperty("user.dir");
      File rootDir = new File(userDir).getParentFile();
      File scraperScript = new File(rootDir, "scraper/google_maps_scraper.py");

      if (!scraperScript.exists()) {
        searchJobService.markError(jobId, "Script de scraping no encontrado: " + scraperScript.getAbsolutePath());
        return;
      }

      log.info("[Job {}] Iniciando grid search: category={} lat={} lon={} radius={}km mode={} aiOptimize={}",
          jobId, category, latitude, longitude, radiusKm, mode, aiOptimize);

      List<String> command = new ArrayList<>(List.of(
          "python",
          scraperScript.getAbsolutePath(),
          "--category", category,
          "--latitude", String.valueOf(latitude),
          "--longitude", String.valueOf(longitude),
          "--radius", String.valueOf(radiusKm),
          "--grid",
          "--mode", (mode != null ? mode : "basic")
      ));
      if (Boolean.TRUE.equals(aiOptimize)) {
        command.add("--ai-optimize");
      }

      ProcessBuilder pb = new ProcessBuilder(command);
      pb.directory(rootDir);

      pb.redirectErrorStream(true);

      Process process = pb.start();

      StringBuilder jsonBuffer = new StringBuilder();
      boolean jsonStarted = false;
      int lastCompletedCells = 0;
      int lastTotalFound = 0;

      try (BufferedReader reader = new BufferedReader(
          new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
          log.info("[Job {}][Scraper] {}", jobId, line);

          // Detect CELL_PROGRESS marker: --- CELL_PROGRESS c/t n ---
          Matcher m = CELL_PROGRESS_PATTERN.matcher(line.trim());
          if (m.matches()) {
            int completed = Integer.parseInt(m.group(1));
            int total     = Integer.parseInt(m.group(2));
            int found     = Integer.parseInt(m.group(3));

            if (lastCompletedCells == 0) {
              // First progress update: mark job as RUNNING with total cells
              searchJobService.markRunning(jobId, total);
            }
            lastCompletedCells = completed;
            lastTotalFound = found;
            searchJobService.updateProgress(jobId, completed, found, List.of());
            log.info("[Job {}] Progress: {}/{} cells, {} leads total", jobId, completed, total, found);
            continue;
          }

          // Parse real-time leads discovered in the completed cell
          if (line.trim().startsWith("--- CELL_LEADS ") && line.trim().endsWith(" ---")) {
            String jsonLeads = line.trim()
                .substring("--- CELL_LEADS ".length(), line.trim().length() - " ---".length());
            try {
              List<Lead> newLeads = objectMapper.readValue(jsonLeads, new TypeReference<List<Lead>>() {});
              searchJobService.updateProgress(jobId, lastCompletedCells, lastTotalFound, newLeads);
              log.info("[Job {}] Ingested {} new leads in real-time.", jobId, newLeads.size());
            } catch (Exception e) {
              log.error("[Job {}] Failed parsing real-time cell leads JSON: {}", jobId, e.getMessage());
            }
            continue;
          }

          if (line.trim().equals("--- JSON_START ---")) {
            jsonStarted = true;
            continue;
          }
          if (jsonStarted) {
            jsonBuffer.append(line).append("\n");
          }
        }
      }


      boolean finished = process.waitFor(gridTimeoutSeconds, java.util.concurrent.TimeUnit.SECONDS);
      if (!finished) {
        process.destroyForcibly();
        searchJobService.markError(jobId,
            "El scraper excedió el tiempo límite de " + gridTimeoutSeconds + " segundos.");
        return;
      }

      int exitCode = process.exitValue();
      log.info("[Job {}] Scraper finalizó con código: {}", jobId, exitCode);

      if (exitCode != 0) {
        searchJobService.markError(jobId, "El scraper falló con código de salida " + exitCode);
        return;
      }

      String jsonOutput = jsonBuffer.toString().trim();
      if (!jsonOutput.isEmpty()) {
        allLeads = objectMapper.readValue(jsonOutput, new TypeReference<List<Lead>>() {});
      }
      searchJobService.markDone(jobId, allLeads);

    } catch (Exception e) {
      log.error("[Job {}] Error en grid scraper", jobId, e);
      searchJobService.markError(jobId, e.getMessage());
    }
  }
}
