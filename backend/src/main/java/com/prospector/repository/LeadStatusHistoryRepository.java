package com.prospector.repository;

import com.prospector.domain.LeadStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LeadStatusHistoryRepository extends JpaRepository<LeadStatusHistory, UUID> {
  List<LeadStatusHistory> findByLeadIdOrderByCreatedAtDesc(UUID leadId);
}
