package com.prospector.service;

import com.prospector.domain.Lead;
import com.prospector.domain.LeadStatus;
import org.springframework.stereotype.Service;

@Service
public class LeadScoringService {
  public int score(Lead lead) {
    int score = 0;
    if (!lead.isHasWebsite()) score += 40;
    if (lead.getBusinessName() != null && !lead.getBusinessName().isBlank()) score += 20;
    if (lead.getPhone() != null && !lead.getPhone().isBlank()) score += 25;
    if (lead.getAddress() != null && !lead.getAddress().isBlank()) score += 15;
    if (lead.getOpeningHours() != null && !lead.getOpeningHours().isBlank()) score += 10;
    if (lead.getEmail() != null && !lead.getEmail().isBlank()) score += 10;
    if (lead.getImageUrl() != null && !lead.getImageUrl().isBlank()) score += 5;
    return Math.min(score, 100);
  }

  public LeadStatus statusFor(int score) {
    if (score >= 70) return LeadStatus.calificado;
    if (score >= 40) return LeadStatus.sin_pagina_web;
    return LeadStatus.baja_prioridad;
  }
}
