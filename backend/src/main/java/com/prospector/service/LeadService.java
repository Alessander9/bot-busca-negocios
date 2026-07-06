package com.prospector.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.prospector.domain.*;
import com.prospector.repository.LeadRepository;
import com.prospector.repository.LeadStatusHistoryRepository;
import com.prospector.repository.SearchRunRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class LeadService {
  private final LeadRepository leadRepository;
  private final LeadStatusHistoryRepository leadStatusHistoryRepository;
  private final SearchRunRepository searchRunRepository;
  private final LeadScoringService scoringService;

  public LeadService(LeadRepository leadRepository,
                     LeadStatusHistoryRepository leadStatusHistoryRepository,
                     SearchRunRepository searchRunRepository,
                     LeadScoringService scoringService) {
    this.leadRepository = leadRepository;
    this.leadStatusHistoryRepository = leadStatusHistoryRepository;
    this.searchRunRepository = searchRunRepository;
    this.scoringService = scoringService;
  }

  public Lead saveManual(Lead lead) {
    int score = scoringService.score(lead);
    lead.setLeadScore(score);
    if (lead.getLeadStatus() == null || lead.getLeadStatus() == LeadStatus.nuevo) {
      lead.setLeadStatus(scoringService.statusFor(score));
    }
    if (lead.getContactStatus() == null) {
      lead.setContactStatus(ContactStatus.pendiente_contacto_manual);
    }
    lead.setUpdatedAt(Instant.now());

    Optional<Lead> existingOpt = leadRepository.findByExternalId(lead.getExternalId());
    if (existingOpt.isPresent()) {
      return merge(existingOpt.get(), lead);
    } else {
      Lead saved = leadRepository.save(lead);
      logHistory(saved, null, saved.getLeadStatus(), null, saved.getContactStatus(), "Creación de lead");
      return saved;
    }
  }

  public List<Lead> saveAll(List<Lead> leads) {
    List<Lead> saved = new ArrayList<>();
    for (Lead lead : leads) {
      saved.add(saveManual(lead));
    }
    return saved;
  }

  public List<Lead> listAll() {
    return leadRepository.findAll();
  }

  public Optional<Lead> findById(UUID id) {
    return leadRepository.findById(id);
  }

  public Optional<Lead> findByExternalId(String externalId) {
    return leadRepository.findByExternalId(externalId);
  }

  public Lead updateManual(UUID id, Lead patch) {
    Lead existing = leadRepository.findById(id)
        .orElseThrow(() -> new IllegalArgumentException("Lead no encontrado con ID: " + id));

    LeadStatus oldStatus = existing.getLeadStatus();
    ContactStatus oldContact = existing.getContactStatus();

    if (patch.getLeadStatus() != null) {
      existing.setLeadStatus(patch.getLeadStatus());
    }
    if (patch.getContactStatus() != null) {
      existing.setContactStatus(patch.getContactStatus());
    }
    if (patch.getNotes() != null) {
      existing.setNotes(patch.getNotes());
    }
    if (patch.getBusinessName() != null) existing.setBusinessName(patch.getBusinessName());
    if (patch.getPhone() != null) existing.setPhone(patch.getPhone());
    if (patch.getEmail() != null) existing.setEmail(patch.getEmail());
    if (patch.getWebsite() != null) {
      existing.setWebsite(patch.getWebsite());
      existing.setHasWebsite(patch.getWebsite() != null && !patch.getWebsite().isBlank());
    }

    int score = scoringService.score(existing);
    existing.setLeadScore(score);
    existing.setUpdatedAt(Instant.now());

    Lead saved = leadRepository.save(existing);

    if (oldStatus != saved.getLeadStatus() || oldContact != saved.getContactStatus()) {
      String note = patch.getNotes() != null && !patch.getNotes().isBlank() ? patch.getNotes() : "Cambio de estado manual";
      logHistory(saved, oldStatus, saved.getLeadStatus(), oldContact, saved.getContactStatus(), note);
    }

    return saved;
  }

  public Lead updateManualByExternalId(String externalId, Lead patch) {
    Lead existing = leadRepository.findByExternalId(externalId)
        .orElseThrow(() -> new IllegalArgumentException("Lead no encontrado con External ID: " + externalId));
    return updateManual(existing.getId(), patch);
  }

  private Lead merge(Lead existing, Lead incoming) {
    existing.setOsmType(incoming.getOsmType());
    existing.setOsmId(incoming.getOsmId());
    existing.setBusinessName(incoming.getBusinessName());
    existing.setCategory(incoming.getCategory());
    existing.setAddress(incoming.getAddress());
    existing.setDistrict(incoming.getDistrict());
    existing.setCity(incoming.getCity());
    existing.setCountry(incoming.getCountry());
    existing.setLatitude(incoming.getLatitude());
    existing.setLongitude(incoming.getLongitude());
    existing.setPhone(incoming.getPhone());
    existing.setEmail(incoming.getEmail());
    existing.setWebsite(incoming.getWebsite());
    existing.setHasWebsite(incoming.isHasWebsite());
    existing.setOpeningHours(incoming.getOpeningHours());
    existing.setBusinessStatus(incoming.getBusinessStatus());
    existing.setImageUrl(incoming.getImageUrl());
    existing.setRawTags(incoming.getRawTags());
    existing.setLeadScore(incoming.getLeadScore());
    existing.setUpdatedAt(Instant.now());
    return leadRepository.save(existing);
  }

  public void saveSearchRun(SearchRun run) {
    searchRunRepository.save(run);
  }

  public void logHistory(Lead lead, LeadStatus oldStatus, LeadStatus newStatus,
                         ContactStatus oldContact, ContactStatus newContact, String note) {
    LeadStatusHistory history = new LeadStatusHistory();
    history.setLead(lead);
    history.setOldLeadStatus(oldStatus);
    history.setNewLeadStatus(newStatus);
    history.setOldContactStatus(oldContact);
    history.setNewContactStatus(newContact);
    history.setNote(note);
    leadStatusHistoryRepository.save(history);
  }

  public String generateCsv() {
    List<Lead> leads = listAll();
    StringBuilder sb = new StringBuilder();
    sb.append("id,business_name,category,lead_status,contact_status,lead_score,website,phone,email,address,district,city,country,latitude,longitude,notes,created_at\n");
    for (Lead lead : leads) {
      sb.append(escapeCsv(String.valueOf(lead.getId()))).append(",")
          .append(escapeCsv(lead.getBusinessName())).append(",")
          .append(escapeCsv(lead.getCategory())).append(",")
          .append(escapeCsv(lead.getLeadStatus() != null ? lead.getLeadStatus().name() : "")).append(",")
          .append(escapeCsv(lead.getContactStatus() != null ? lead.getContactStatus().name() : "")).append(",")
          .append(lead.getLeadScore()).append(",")
          .append(escapeCsv(lead.getWebsite())).append(",")
          .append(escapeCsv(lead.getPhone())).append(",")
          .append(escapeCsv(lead.getEmail())).append(",")
          .append(escapeCsv(lead.getAddress())).append(",")
          .append(escapeCsv(lead.getDistrict())).append(",")
          .append(escapeCsv(lead.getCity())).append(",")
          .append(escapeCsv(lead.getCountry())).append(",")
          .append(lead.getLatitude()).append(",")
          .append(lead.getLongitude()).append(",")
          .append(escapeCsv(lead.getNotes())).append(",")
          .append(lead.getCreatedAt()).append("\n");
    }
    return sb.toString();
  }

  private String escapeCsv(String value) {
    if (value == null) return "";
    String val = value.replace("\"", "\"\"");
    if (val.contains(",") || val.contains("\n") || val.contains("\"")) {
      return "\"" + val + "\"";
    }
    return val;
  }

  public Lead fromOverpassElement(JsonNode element, String category) {
    JsonNode tags = element.path("tags");
    String name = firstNonBlank(tags, "name", "brand");
    if (name == null) return null;

    Lead lead = new Lead();
    lead.setExternalId(element.path("type").asText() + "_" + element.path("id").asText());
    lead.setOsmType(element.path("type").asText());
    lead.setOsmId(element.path("id").asText());
    lead.setBusinessName(name);
    lead.setCategory(category);
    lead.setAddress(firstNonBlank(tags, "addr:full"));
    if (lead.getAddress() == null) {
      String street = firstNonBlank(tags, "addr:street");
      String num = firstNonBlank(tags, "addr:housenumber");
      if (street != null) {
        lead.setAddress(street + (num != null ? " " + num : ""));
      }
    }
    lead.setDistrict(firstNonBlank(tags, "addr:district", "addr:suburb"));
    lead.setCity(firstNonBlank(tags, "addr:city", "city"));
    if (lead.getCity() == null) lead.setCity("Lima");
    lead.setCountry("Perú");
    lead.setPhone(firstNonBlank(tags, "phone", "contact:phone"));
    lead.setEmail(firstNonBlank(tags, "email", "contact:email"));
    lead.setWebsite(firstNonBlank(tags, "website", "contact:website", "url"));
    lead.setHasWebsite(lead.getWebsite() != null);
    lead.setOpeningHours(firstNonBlank(tags, "opening_hours"));
    lead.setImageUrl(firstNonBlank(tags, "image", "wikimedia_commons"));
    lead.setRawTags(new java.util.HashMap<>());
    tags.fields().forEachRemaining(entry -> lead.getRawTags().put(entry.getKey(), entry.getValue().asText()));

    if (element.path("type").asText().equals("node")) {
      lead.setLatitude(new BigDecimal(element.path("lat").asText()));
      lead.setLongitude(new BigDecimal(element.path("lon").asText()));
    } else if (element.has("center")) {
      lead.setLatitude(new BigDecimal(element.path("center").path("lat").asText()));
      lead.setLongitude(new BigDecimal(element.path("center").path("lon").asText()));
    }
    return lead;
  }

  private String firstNonBlank(JsonNode tags, String... keys) {
    for (String key : keys) {
      String value = tags.path(key).asText(null);
      if (value != null && !value.isBlank()) return value;
    }
    return null;
  }
}
