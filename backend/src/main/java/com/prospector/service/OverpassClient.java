package com.prospector.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OverpassClient {
  private final RestClient restClient;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public OverpassClient(@Value("${app.overpass.endpoint:https://overpass-api.de/api/interpreter}") String endpoint) {
    this.restClient = RestClient.builder().baseUrl(endpoint).build();
  }

  public JsonNode fetch(String query) {
    String body = "data=" + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8);
    String response = restClient.post()
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .body(body)
        .retrieve()
        .body(String.class);
    try {
      return objectMapper.readTree(response);
    } catch (Exception e) {
      throw new IllegalStateException("Respuesta Overpass invalida", e);
    }
  }
}
