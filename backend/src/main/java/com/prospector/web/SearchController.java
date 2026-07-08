package com.prospector.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.prospector.domain.*;
import com.prospector.service.CrawleeScraperService;
import com.prospector.service.LeadScoringService;
import com.prospector.service.LeadService;
import com.prospector.service.OverpassClient;
import com.prospector.service.SearchJobService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"})
public class SearchController {
  private static final Logger log = LoggerFactory.getLogger(SearchController.class);

  private final OverpassClient overpassClient;
  private final LeadService leadService;
  private final LeadScoringService scoringService;
  private final CrawleeScraperService crawleeScraperService;
  private final SearchJobService searchJobService;

  public SearchController(OverpassClient overpassClient,
                          LeadService leadService,
                          LeadScoringService scoringService,
                          CrawleeScraperService crawleeScraperService,
                          SearchJobService searchJobService) {
    this.overpassClient = overpassClient;
    this.leadService = leadService;
    this.scoringService = scoringService;
    this.crawleeScraperService = crawleeScraperService;
    this.searchJobService = searchJobService;
  }

  // -------------------------------------------------------------------------
  // NEW: Async Google Maps Grid Search
  // -------------------------------------------------------------------------

  /**
   * Starts a background grid search on Google Maps.
   * Returns a jobId immediately — client must poll /search-status/{jobId}.
   */
  @PostMapping("/search-googlemaps")
  public ResponseEntity<Map<String, String>> startGridSearch(@RequestBody SearchRequest request) {
    validate(request);
    String mode = (request.mode != null && !request.mode.isBlank()) ? request.mode : "basic";
    UUID jobId = searchJobService.createJob(
        request.category, request.latitude, request.longitude, request.radiusKm);

    // Launch scraping in background thread — does NOT block this request
    CompletableFuture.runAsync(() ->
        crawleeScraperService.scrapeGoogleMapsGrid(
            jobId, request.category, request.latitude, request.longitude, request.radiusKm, mode, request.aiOptimize)
    );

    log.info("Grid search job {} started for category={} mode={}", jobId, request.category, mode);
    return ResponseEntity.accepted().body(Map.of(
        "jobId", jobId.toString(),
        "status", "PENDING",
        "mode", mode
    ));
  }

  /**
   * Poll endpoint: returns current job status, progress, and accumulated partial results.
   */
  @GetMapping("/search-status/{jobId}")
  public ResponseEntity<?> getSearchStatus(@PathVariable String jobId) {
    UUID id;
    try {
      id = UUID.fromString(jobId);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", "jobId inválido"));
    }

    return searchJobService.getJob(id)
        .map(job -> {
          // Score partial results in real-time as they accumulate
          List<Lead> leads = job.getPartialResults();
          leads.forEach(l -> {
            int score = scoringService.score(l);
            l.setLeadScore(score);
            l.setLeadStatus(scoringService.statusFor(score));
            if (l.getContactStatus() == null) {
              l.setContactStatus(ContactStatus.pendiente_contacto_manual);
            }
          });

          return ResponseEntity.ok(Map.of(
              "jobId",          job.getJobId().toString(),
              "status",         job.getStatus().name(),
              "totalCells",     job.getTotalCells(),
              "completedCells", job.getCompletedCells(),
              "totalFound",     job.getTotalFound(),
              "partialResults", leads,
              "errorMessage",   job.getErrorMessage() != null ? job.getErrorMessage() : ""
          ));
        })
        .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "Job no encontrado: " + jobId)));
  }

  // -------------------------------------------------------------------------
  // Legacy OSM search (kept for reference, Google Maps now uses async grid)
  // -------------------------------------------------------------------------

  @PostMapping("/search-osm")
  public List<Lead> search(@RequestBody SearchRequest request) {
    validate(request);

    List<Lead> leads = new ArrayList<>();
    int totalFound = 0;
    int totalWithoutWebsite = 0;

    log.info("Iniciando búsqueda en OpenStreetMap para rubro: {}", request.category);
    String query = buildQuery(request.category, request.latitude, request.longitude, request.radiusKm);
    JsonNode response = overpassClient.fetch(query);

    for (JsonNode element : response.path("elements")) {
      Lead lead = leadService.fromOverpassElement(element, request.category);
      if (lead != null) {
        totalFound++;
        int score = scoringService.score(lead);
        lead.setLeadScore(score);
        lead.setLeadStatus(scoringService.statusFor(score));
        lead.setContactStatus(ContactStatus.pendiente_contacto_manual);
        if (!lead.isHasWebsite()) {
          totalWithoutWebsite++;
        }
        leads.add(lead);
      }
    }

    // Save SearchRun record
    SearchRun run = new SearchRun();
    run.setCategory(request.category);
    run.setLatitude(BigDecimal.valueOf(request.latitude));
    run.setLongitude(BigDecimal.valueOf(request.longitude));
    run.setRadiusKm(BigDecimal.valueOf(request.radiusKm));
    run.setTotalFound(totalFound);
    run.setTotalWithoutWebsite(totalWithoutWebsite);
    run.setTotalSaved(0);
    run.setCity("Lima");
    leadService.saveSearchRun(run);

    return leads;
  }


  @PostMapping("/leads/save")
  public List<Lead> save(@RequestBody List<Lead> leads) {
    return leadService.saveAll(leads);
  }

  @GetMapping("/leads")
  public List<Lead> all() {
    return leadService.listAll();
  }

  @GetMapping("/leads/{id}")
  public ResponseEntity<Lead> getLead(@PathVariable String id) {
    try {
      UUID uuid = UUID.fromString(id);
      return leadService.findById(uuid)
          .map(ResponseEntity::ok)
          .orElse(ResponseEntity.notFound().build());
    } catch (IllegalArgumentException e) {
      return leadService.findByExternalId(id)
          .map(ResponseEntity::ok)
          .orElse(ResponseEntity.notFound().build());
    }
  }

  @PatchMapping("/leads/{id}")
  public ResponseEntity<Lead> update(@PathVariable String id, @RequestBody Lead patch) {
    try {
      UUID uuid = UUID.fromString(id);
      return ResponseEntity.ok(leadService.updateManual(uuid, patch));
    } catch (IllegalArgumentException e) {
      try {
        return ResponseEntity.ok(leadService.updateManualByExternalId(id, patch));
      } catch (Exception ex) {
        return ResponseEntity.notFound().build();
      }
    }
  }

  @GetMapping("/dashboard")
  public DashboardResponse dashboard() {
    List<Lead> leads = leadService.listAll();
    Map<String, Long> byCategory = leads.stream()
        .filter(l -> l.getCategory() != null)
        .collect(Collectors.groupingBy(Lead::getCategory, Collectors.counting()));
    return new DashboardResponse(
        leads.size(),
        leads.stream().filter(l -> !l.isHasWebsite()).count(),
        leads.stream().filter(l -> LeadStatus.calificado.equals(l.getLeadStatus())).count(),
        leads.stream().filter(l -> ContactStatus.contactado.equals(l.getContactStatus())).count(),
        leads.stream().filter(l -> ContactStatus.interesado.equals(l.getContactStatus())).count(),
        leads.stream().filter(l -> ContactStatus.cerrado.equals(l.getContactStatus())).count(),
        byCategory
    );
  }

  @GetMapping("/export/csv")
  public ResponseEntity<byte[]> exportCsv() {
    String csv = leadService.generateCsv();
    byte[] data = csv.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"leads.csv\"")
        .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
        .body(data);
  }

  private void validate(SearchRequest request) {
    if (request.category == null || request.category.isBlank()) throw new IllegalArgumentException("category es requerido");
    if (request.latitude == null || request.longitude == null) throw new IllegalArgumentException("latitud y longitud son requeridas");
    if (request.radiusKm == null) throw new IllegalArgumentException("radiusKm es requerido");
    if (request.radiusKm < 1 || request.radiusKm > 10) throw new IllegalArgumentException("radiusKm debe estar entre 1 y 10");
  }

  private String buildQuery(String category, Double latitude, Double longitude, Integer radiusKm) {
    List<String> filters = switch (category.toLowerCase()) {
      case "restaurantes" -> List.of(
          "amenity=restaurant",
          "amenity=fast_food",
          "amenity=cafe"
      );
      case "barberias" -> List.of(
          "shop=hairdresser",
          "shop=beauty"
      );
      case "veterinarias" -> List.of("amenity=veterinary");
      case "talleres" -> List.of("shop=car_repair", "craft=mechanic");
      case "ferreterias" -> List.of("shop=hardware", "shop=doityourself");
      case "consultorios" -> List.of(
          "amenity=clinic",
          "healthcare=clinic",
          "healthcare=doctor",
          "amenity=doctors",
          "amenity=dentist"
      );
      default -> List.of("amenity=restaurant");
    };

    int radiusM = radiusKm * 1000;
    StringBuilder sb = new StringBuilder("[out:json][timeout:60];\n(\n");
    for (String filter : filters) {
      String[] kv = filter.split("=", 2);
      String key = kv[0];
      String value = kv[1];
      sb.append("  node[\"").append(key).append("\"=\"").append(value).append("\"](around:")
          .append(radiusM).append(",").append(latitude).append(",").append(longitude).append(");\n");
      sb.append("  way[\"").append(key).append("\"=\"").append(value).append("\"](around:")
          .append(radiusM).append(",").append(latitude).append(",").append(longitude).append(");\n");
      sb.append("  relation[\"").append(key).append("\"=\"").append(value).append("\"](around:")
          .append(radiusM).append(",").append(latitude).append(",").append(longitude).append(");\n");
    }
    sb.append(");\nout center tags;");
    return sb.toString();
  }

  public record DashboardResponse(
      long totalLeads,
      long leadsSinWebsite,
      long leadsCalificados,
      long leadsContactados,
      long leadsInteresados,
      long leadsCerrados,
      Map<String, Long> leadsPorRubro
  ) {}

  public static class SearchRequest {
    public String category;
    public Double latitude;
    public Double longitude;
    public Integer radiusKm;
    public String source;
    /** "basic" (default) or "complete" (all aliases) */
    public String mode = "basic";
    public Boolean aiOptimize = false;

    @com.fasterxml.jackson.annotation.JsonSetter("ai_optimize")
    public void setAiOptimizeSnake(Boolean aiOptimize) {
      this.aiOptimize = aiOptimize;
    }

    @com.fasterxml.jackson.annotation.JsonSetter("aiOptimize")
    public void setAiOptimizeCamel(Boolean aiOptimize) {
      this.aiOptimize = aiOptimize;
    }

    public void setRadiusKm(Integer radiusKm) {
      this.radiusKm = radiusKm;
    }

    @com.fasterxml.jackson.annotation.JsonSetter("radius_km")
    public void setRadiusKmSnake(Integer radiusKm) {
      this.radiusKm = radiusKm;
    }

    @com.fasterxml.jackson.annotation.JsonSetter("radiusKm")
    public void setRadiusKmCamel(Integer radiusKm) {
      this.radiusKm = radiusKm;
    }
  }
}
