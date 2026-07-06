package com.prospector.service;

import com.prospector.domain.Lead;
import com.prospector.domain.LeadStatus;
import org.springframework.stereotype.Service;

@Service
public class LeadScoringService {
  public int score(Lead lead) {
    int score = 0;
    
    // Core indicator: no website (+40 priority)
    if (!lead.isHasWebsite()) score += 40;
    
    // Basic contact data indicators
    if (lead.getBusinessName() != null && !lead.getBusinessName().isBlank()) score += 15;
    if (lead.getPhone() != null && !lead.getPhone().isBlank()) score += 20;
    if (lead.getAddress() != null && !lead.getAddress().isBlank()) score += 10;
    
    // Smart lead prioritization based on popularity / reviews
    if (!lead.isHasWebsite() && lead.getReviewsCount() != null) {
      if (lead.getReviewsCount() > 1500) {
        // Exclude massive chains as they manage web at corporate level
        score -= 25;
      } else if (lead.getReviewsCount() > 150) {
        // Highly popular local businesses without websites are prime hot prospects
        score += 20;
      } else if (lead.getReviewsCount() > 30) {
        // Mid-sized stable businesses are warm prospects
        score += 10;
      }
    }

    // Reputation management indicator: rating < 3.8 and has enough reviews (>5)
    if (lead.getRating() != null && lead.getRating() > 0.0 && lead.getRating() < 3.8) {
      if (lead.getReviewsCount() != null && lead.getReviewsCount() > 5) {
        score += 10;
      }
    }
    
    if (lead.getOpeningHours() != null && !lead.getOpeningHours().isBlank()) score += 5;
    if (lead.getImageUrl() != null && !lead.getImageUrl().isBlank()) score += 5;
    
    return Math.max(0, Math.min(score, 100));
  }

  public LeadStatus statusFor(int score) {
    if (score >= 70) return LeadStatus.calificado;
    if (score >= 40) return LeadStatus.sin_pagina_web;
    return LeadStatus.baja_prioridad;
  }

}
