package com.prospector.repository;

import com.prospector.domain.SearchRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SearchRunRepository extends JpaRepository<SearchRun, UUID> {
}
