package com.prospector.repository;

import com.prospector.domain.Lead;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LeadRepository extends JpaRepository<Lead, UUID> {
  Optional<Lead> findByExternalId(String externalId);
}
