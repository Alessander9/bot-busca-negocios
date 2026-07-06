package com.prospector.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "leads")
public class Lead {
  @Id
  @GeneratedValue
  private UUID id;

  private String source = "openstreetmap";

  @Column(name = "external_id", unique = true)
  private String externalId;

  private String osmType;
  private String osmId;
  private String businessName;
  private String category;
  private String address;
  private String district;
  private String city = "Lima";
  private String country = "Perú";
  private BigDecimal latitude;
  private BigDecimal longitude;
  private String phone;
  private String email;
  private String website;
  private boolean hasWebsite = false;
  private String openingHours;
  private String businessStatus = "unknown";
  private String imageUrl;

  @Convert(converter = JsonMapConverter.class)
  @Column(columnDefinition = "jsonb")
  private Map<String, Object> rawTags;

  private Integer leadScore = 0;

  @Enumerated(EnumType.STRING)
  private LeadStatus leadStatus = LeadStatus.nuevo;

  @Enumerated(EnumType.STRING)
  private ContactStatus contactStatus = ContactStatus.pendiente_contacto_manual;

  @Column(columnDefinition = "text")
  private String notes;

  private Instant createdAt = Instant.now();
  private Instant updatedAt = Instant.now();

  // Getters and Setters

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public String getSource() {
    return source;
  }

  public void setSource(String source) {
    this.source = source;
  }

  public String getExternalId() {
    return externalId;
  }

  public void setExternalId(String externalId) {
    this.externalId = externalId;
  }

  public String getOsmType() {
    return osmType;
  }

  public void setOsmType(String osmType) {
    this.osmType = osmType;
  }

  public String getOsmId() {
    return osmId;
  }

  public void setOsmId(String osmId) {
    this.osmId = osmId;
  }

  public String getBusinessName() {
    return businessName;
  }

  public void setBusinessName(String businessName) {
    this.businessName = businessName;
  }

  public String getCategory() {
    return category;
  }

  public void setCategory(String category) {
    this.category = category;
  }

  public String getAddress() {
    return address;
  }

  public void setAddress(String address) {
    this.address = address;
  }

  public String getDistrict() {
    return district;
  }

  public void setDistrict(String district) {
    this.district = district;
  }

  public String getCity() {
    return city;
  }

  public void setCity(String city) {
    this.city = city;
  }

  public String getCountry() {
    return country;
  }

  public void setCountry(String country) {
    this.country = country;
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

  public String getPhone() {
    return phone;
  }

  public void setPhone(String phone) {
    this.phone = phone;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getWebsite() {
    return website;
  }

  public void setWebsite(String website) {
    this.website = website;
  }

  public boolean isHasWebsite() {
    return hasWebsite;
  }

  public void setHasWebsite(boolean hasWebsite) {
    this.hasWebsite = hasWebsite;
  }

  public String getOpeningHours() {
    return openingHours;
  }

  public void setOpeningHours(String openingHours) {
    this.openingHours = openingHours;
  }

  public String getBusinessStatus() {
    return businessStatus;
  }

  public void setBusinessStatus(String businessStatus) {
    this.businessStatus = businessStatus;
  }

  public String getImageUrl() {
    return imageUrl;
  }

  public void setImageUrl(String imageUrl) {
    this.imageUrl = imageUrl;
  }

  public Map<String, Object> getRawTags() {
    return rawTags;
  }

  public void setRawTags(Map<String, Object> rawTags) {
    this.rawTags = rawTags;
  }

  public Integer getLeadScore() {
    return leadScore;
  }

  public void setLeadScore(Integer leadScore) {
    this.leadScore = leadScore;
  }

  public LeadStatus getLeadStatus() {
    return leadStatus;
  }

  public void setLeadStatus(LeadStatus leadStatus) {
    this.leadStatus = leadStatus;
  }

  public ContactStatus getContactStatus() {
    return contactStatus;
  }

  public void setContactStatus(ContactStatus contactStatus) {
    this.contactStatus = contactStatus;
  }

  public String getNotes() {
    return notes;
  }

  public void setNotes(String notes) {
    this.notes = notes;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant updatedAt) {
    this.updatedAt = updatedAt;
  }
}
