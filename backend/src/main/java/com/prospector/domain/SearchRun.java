package com.prospector.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "search_runs")
public class SearchRun {
  @Id
  @GeneratedValue
  private UUID id;

  private String category;
  private String city = "Lima";
  private String district;
  private BigDecimal latitude;
  private BigDecimal longitude;
  private BigDecimal radiusKm;
  private int totalFound = 0;
  private int totalWithoutWebsite = 0;
  private int totalSaved = 0;
  private Instant createdAt = Instant.now();

  // Getters and Setters

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public String getCategory() {
    return category;
  }

  public void setCategory(String category) {
    this.category = category;
  }

  public String getCity() {
    return city;
  }

  public void setCity(String city) {
    this.city = city;
  }

  public String getDistrict() {
    return district;
  }

  public void setDistrict(String district) {
    this.district = district;
  }

  public BigDecimal getLatitude() {
    return latitude;
  }

  public void setLatitude(BigDecimal latitude) {
    this.latitude = latitude;
  }

  public BigDecimal getLongitude() {
    return longitude;
  }

  public void setLongitude(BigDecimal longitude) {
    this.longitude = longitude;
  }

  public BigDecimal getRadiusKm() {
    return radiusKm;
  }

  public void setRadiusKm(BigDecimal radiusKm) {
    this.radiusKm = radiusKm;
  }

  public int getTotalFound() {
    return totalFound;
  }

  public void setTotalFound(int totalFound) {
    this.totalFound = totalFound;
  }

  public int getTotalWithoutWebsite() {
    return totalWithoutWebsite;
  }

  public void setTotalWithoutWebsite(int totalWithoutWebsite) {
    this.totalWithoutWebsite = totalWithoutWebsite;
  }

  public int getTotalSaved() {
    return totalSaved;
  }

  public void setTotalSaved(int totalSaved) {
    this.totalSaved = totalSaved;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }
}
