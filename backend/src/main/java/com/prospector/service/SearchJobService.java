package com.prospector.service;

import com.prospector.domain.Lead;
import com.prospector.domain.SearchJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages in-memory grid-search jobs.
 * Jobs older than 2 hours are automatically purged to prevent memory leaks.
 */
@Service
public class SearchJobService {

    private static final Logger log = LoggerFactory.getLogger(SearchJobService.class);
    private final Map<UUID, SearchJob> jobs = new ConcurrentHashMap<>();

    /** Create a new PENDING job and return its ID. */
    public UUID createJob(String category, Double latitude, Double longitude, Integer radiusKm) {
        SearchJob job = new SearchJob(category, latitude, longitude, radiusKm);
        jobs.put(job.getJobId(), job);
        log.info("Created search job {} for category={} lat={} lon={} radius={}km",
                job.getJobId(), category, latitude, longitude, radiusKm);
        return job.getJobId();
    }

    public Optional<SearchJob> getJob(UUID jobId) {
        return Optional.ofNullable(jobs.get(jobId));
    }

    public void markRunning(UUID jobId, int totalCells) {
        getJob(jobId).ifPresent(j -> j.markRunning(totalCells));
    }

    /**
     * Called each time a grid cell finishes.
     * @param completedCells number of cells done so far
     * @param totalFound     total unique leads accumulated
     * @param newLeads       leads from this specific cell
     */
    public void updateProgress(UUID jobId, int completedCells, int totalFound, List<Lead> newLeads) {
        getJob(jobId).ifPresent(j -> j.updateProgress(completedCells, totalFound, newLeads));
    }

    public void markDone(UUID jobId, List<Lead> finalLeads) {
        getJob(jobId).ifPresent(j -> {
            j.markDone(finalLeads);
            log.info("Job {} DONE — {} leads found.", jobId, finalLeads.size());
        });
    }

    public void markError(UUID jobId, String message) {
        getJob(jobId).ifPresent(j -> {
            j.markError(message);
            log.error("Job {} ERROR: {}", jobId, message);
        });
    }

    /** Purge jobs finished more than 2 hours ago to prevent unbounded memory growth. */
    @Scheduled(fixedDelay = 1_800_000) // every 30 minutes
    public void purgeOldJobs() {
        Instant cutoff = Instant.now().minus(2, ChronoUnit.HOURS);
        jobs.entrySet().removeIf(e -> {
            SearchJob j = e.getValue();
            boolean done = j.getStatus() == SearchJob.JobStatus.DONE
                    || j.getStatus() == SearchJob.JobStatus.ERROR;
            boolean old = j.getFinishedAt() != null && j.getFinishedAt().isBefore(cutoff);
            if (done && old) {
                log.info("Purging old job {}", e.getKey());
                return true;
            }
            return false;
        });
    }
}
