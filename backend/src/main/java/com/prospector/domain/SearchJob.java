package com.prospector.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * In-memory representation of a background grid-search job.
 * Not a JPA entity — stored in ConcurrentHashMap in SearchJobService.
 */
public class SearchJob {

    public enum JobStatus { PENDING, RUNNING, DONE, ERROR }

    private final UUID jobId;
    private volatile JobStatus status;

    // Search parameters
    private final String category;
    private final Double latitude;
    private final Double longitude;
    private final Integer radiusKm;

    // Progress tracking
    private volatile int totalCells;
    private volatile int completedCells;
    private volatile int totalFound;

    // Partial results accumulated as each cell completes
    private final List<Lead> partialResults;

    private volatile String errorMessage;
    private final Instant startedAt;
    private volatile Instant finishedAt;

    public SearchJob(String category, Double latitude, Double longitude, Integer radiusKm) {
        this.jobId = UUID.randomUUID();
        this.status = JobStatus.PENDING;
        this.category = category;
        this.latitude = latitude;
        this.longitude = longitude;
        this.radiusKm = radiusKm;
        this.partialResults = new ArrayList<>();
        this.startedAt = Instant.now();
    }

    // -----------------------------------------------------------------------
    // Mutators (called from SearchJobService under synchronization)
    // -----------------------------------------------------------------------

    public synchronized void markRunning(int totalCells) {
        this.status = JobStatus.RUNNING;
        this.totalCells = totalCells;
    }

    public synchronized void updateProgress(int completedCells, int totalFound, List<Lead> newLeads) {
        this.completedCells = completedCells;
        this.totalFound = totalFound;
        this.partialResults.addAll(newLeads);
    }

    public synchronized void markDone(List<Lead> finalLeads) {
        this.partialResults.clear();
        this.partialResults.addAll(finalLeads);
        this.totalFound = finalLeads.size();
        this.status = JobStatus.DONE;
        this.finishedAt = Instant.now();
    }

    public synchronized void markError(String message) {
        this.errorMessage = message;
        this.status = JobStatus.ERROR;
        this.finishedAt = Instant.now();
    }

    // -----------------------------------------------------------------------
    // Accessors
    // -----------------------------------------------------------------------

    public UUID getJobId()                  { return jobId; }
    public JobStatus getStatus()            { return status; }
    public String getCategory()             { return category; }
    public Double getLatitude()             { return latitude; }
    public Double getLongitude()            { return longitude; }
    public Integer getRadiusKm()            { return radiusKm; }
    public int getTotalCells()              { return totalCells; }
    public int getCompletedCells()          { return completedCells; }
    public int getTotalFound()              { return totalFound; }
    public synchronized List<Lead> getPartialResults() { return new ArrayList<>(partialResults); }
    public String getErrorMessage()         { return errorMessage; }
    public Instant getStartedAt()           { return startedAt; }
    public Instant getFinishedAt()          { return finishedAt; }
}
