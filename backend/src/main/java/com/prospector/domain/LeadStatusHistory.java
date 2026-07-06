package com.prospector.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "lead_status_history")
public class LeadStatusHistory {
  @Id
  @GeneratedValue
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "lead_id", nullable = false)
  private Lead lead;

  @Enumerated(EnumType.STRING)
  private LeadStatus oldLeadStatus;

  @Enumerated(EnumType.STRING)
  private LeadStatus newLeadStatus;

  @Enumerated(EnumType.STRING)
  private ContactStatus oldContactStatus;

  @Enumerated(EnumType.STRING)
  private ContactStatus newContactStatus;

  @Column(columnDefinition = "text")
  private String note;

  private Instant createdAt = Instant.now();

  // Getters and Setters

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public Lead getLead() {
    return lead;
  }

  public void setLead(Lead lead) {
    this.lead = lead;
  }

  public LeadStatus getOldLeadStatus() {
    return oldLeadStatus;
  }

  public void setOldLeadStatus(LeadStatus oldLeadStatus) {
    this.oldLeadStatus = oldLeadStatus;
  }

  public LeadStatus getNewLeadStatus() {
    return newLeadStatus;
  }

  public void setNewLeadStatus(LeadStatus newLeadStatus) {
    this.newLeadStatus = newLeadStatus;
  }

  public ContactStatus getOldContactStatus() {
    return oldContactStatus;
  }

  public void setOldContactStatus(ContactStatus oldContactStatus) {
    this.oldContactStatus = oldContactStatus;
  }

  public ContactStatus getNewContactStatus() {
    return newContactStatus;
  }

  public void setNewContactStatus(ContactStatus newContactStatus) {
    this.newContactStatus = newContactStatus;
  }

  public String getNote() {
    return note;
  }

  public void setNote(String note) {
    this.note = note;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }
}
