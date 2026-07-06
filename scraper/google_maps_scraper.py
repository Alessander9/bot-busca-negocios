import asyncio
import sys
import json
import argparse
import math
import random
import unicodedata

from crawlee import Request, ConcurrencySettings
from crawlee.router import Router
from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext

# Ensure we write utf-8 output to stdout
sys.stdout.reconfigure(encoding='utf-8')

# ---------------------------------------------------------------------------
# Geo utilities
# ---------------------------------------------------------------------------

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in km between two lat/lon points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def generate_grid_points(center_lat: float, center_lon: float, radius_km: float,
                          grid_size: int = 4, overlap: float = 0.15):
    """
    Generate a list of (lat, lon) search points arranged in a grid.
    - overlap: fraction of cell size added as padding to avoid missing businesses at borders.
    - Only points within the original circular radius are kept (no wasted corner searches).
    """
    cell_km = (radius_km * 2) / grid_size * (1 + overlap)
    step_lat = cell_km / 111.0
    step_lon = cell_km / (111.0 * math.cos(math.radians(center_lat)))

    offset_lat = (grid_size - 1) / 2 * step_lat
    offset_lon = (grid_size - 1) / 2 * step_lon

    points = []
    for i in range(grid_size):
        for j in range(grid_size):
            lat = center_lat - offset_lat + step_lat * i
            lon = center_lon - offset_lon + step_lon * j
            if haversine(center_lat, center_lon, lat, lon) <= radius_km:
                points.append((lat, lon))
    return points


# Lima density zones (distance from Plaza Mayor -12.0464, -77.0428)
DENSITY_LEVELS = {
    "alta":  4,   # < 5 km  → Miraflores, San Isidro, Barranco, Centro
    "media": 4,   # < 15 km → Surco, San Borja, La Molina, Ate
    "baja":  3,   # >= 15km → Carabayllo, Villa El Salvador, etc.
}

def detect_grid_size(lat: float, lon: float) -> int:
    dist = haversine(lat, lon, -12.0464, -77.0428)
    if dist < 5:
        return DENSITY_LEVELS["alta"]
    elif dist < 15:
        return DENSITY_LEVELS["media"]
    return DENSITY_LEVELS["baja"]

# List of domains that are NOT considered a custom commercial website
def is_real_custom_website(url: str) -> bool:
    if not url:
        return False
    url_lower = url.lower()
    non_custom_patterns = [
        # Redes sociales
        "facebook.com", "instagram.com", "twitter.com", "x.com",
        "tiktok.com", "linkedin.com", "youtube.com", "snapchat.com",
        "pinterest.com", "threads.net",
        # Mensajería
        "wa.me", "whatsapp.com", "api.whatsapp", "t.me", "telegram.me",
        # Perfiles de empresa / directorios
        "business.site", "google.com/business", "google.es", "google.com",
        "yelp.com", "tripadvisor", "foursquare.com",
        "paginasamarillas", "cylex", "infobel", "dondeseguia",
        "amarillas.com", "locanto", "adondevivir.com",
        # Bio-link y constructores gratuitos
        "linktr.ee", "campsite.bio", "bio.link", "beacons.ai",
        "linkinbio", "carrd.co", "about.me",
        "wix.com", "weebly.com", "jimdo.com", "webnode",
        # Freelance / portafolio
        "behance.net", "dribbble.com",
        # Agendamiento y servicios SaaS LATAM
        "agendapro.com", "reservo.com", "clinicacloud.com",
        "doctoralia.com", "medilink", "salud.bo",
        # Delivery / marketplaces
        "rappi.com", "ifood.com", "ubereats.com", "glovo.com",
        "pedidosya.com", "justo.pe"
    ]
    for pattern in non_custom_patterns:
        if pattern in url_lower:
            return False
    return True

# ---------------------------------------------------------------------------
# Single-cell scrape helper (reusable for both single and grid modes)
# ---------------------------------------------------------------------------

async def scrape_single_cell(category: str, search_url: str, args) -> list:
    """
    Runs one PlaywrightCrawler search on a single Google Maps URL.
    Returns a list of raw lead dicts found in that cell.
    """
    cell_results = []
    router = Router[PlaywrightCrawlingContext]()

    @router.default_handler
    async def search_handler(context: PlaywrightCrawlingContext) -> None:
        page = context.page
        context.log.info(f"Navigating to search page: {search_url}")
        
        # 1. Force Full HD viewport to maximize map area and load more elements
        await page.set_viewport_size({"width": 1920, "height": 1080})

        # 2. Extract latitude/longitude from search_url to spoof GPS geolocation
        lat, lon = None, None
        if "@" in search_url:
            parts = search_url.split("@")[1].split(",")
            if len(parts) >= 2:
                try:
                    lat = float(parts[0])
                    lon = float(parts[1])
                except ValueError:
                    pass

        if lat is not None and lon is not None:
            try:
                # Configure fake browser GPS coordinates to bypass ISP/datacenter IP tracking
                await page.context.set_geolocation({"latitude": lat, "longitude": lon})
                await page.context.grant_permissions(["geolocation"], origin="https://www.google.com")
                context.log.info(f"Spoofed browser GPS to: {lat}, {lon}")
            except Exception as geo_err:
                context.log.warning(f"Failed to configure geolocation context: {geo_err}")

        # Navigate and wait for content
        await page.goto(search_url, wait_until="domcontentloaded")
        
        # 3. Check if 'Search this area' floating button exists, and click it to lock coordinates
        try:
            await page.wait_for_timeout(2000)
            search_area_btn = await page.query_selector('button[jsaction*="searchthisarea"]')
            if search_area_btn:
                context.log.info("Google Maps shifted center. Clicking 'Buscar en esta área' to lock coordinates.")
                await search_area_btn.click()
                await page.wait_for_timeout(2000)
        except Exception:
            pass

        # Wait for initial results sidebar
        try:
            await page.wait_for_selector('a[href*="/maps/place/"]', timeout=15000)
        except Exception:
            context.log.warning("No initial results found or page took too long.")
            return

        # Feed container selector for scrolling results
        feed_selector = 'div[role="feed"]'
        feed_found = False
        try:
            await page.wait_for_selector(feed_selector, timeout=5000)
            feed_found = True
        except Exception:
            pass

        if feed_found:

            context.log.info("Waking up Google Maps lazy loader panel...")
            try:
                # Hover mouse over the center of the feed to wake up the scrolling engine
                feed_box = await page.locator(feed_selector).bounding_box()
                if feed_box:
                    await page.mouse.move(
                        feed_box['x'] + feed_box['width'] / 2, 
                        feed_box['y'] + feed_box['height'] / 2
                    )
            except Exception as e:
                context.log.warning(f"Failed to hover over feed: {e}")

            context.log.info("Scrolling feed to load maximum results (smart scroll)...")
            MAX_SCROLLS = 40
            prev_count = 0
            no_change_streak = 0
            for i in range(MAX_SCROLLS):
                try:
                    await page.evaluate(
                        f'document.querySelector("{feed_selector}").scrollBy(0, 2000);'
                    )
                    await asyncio.sleep(1.0)

                    # Count current visible place links
                    current_elements = await page.query_selector_all('a[href*="/maps/place/"]')
                    current_count = len(current_elements)

                    if current_count == prev_count:
                        no_change_streak += 1
                        if no_change_streak >= 3:  # 3 scrolls sin nuevos resultados = fin real
                            context.log.info(
                                f"Smart scroll: no new results after {i + 1} scrolls "
                                f"({current_count} places found). Stopping."
                            )
                            break
                    else:
                        no_change_streak = 0  # reset streak if new results appeared

                    prev_count = current_count
                except Exception:
                    break

        # Extract place links
        place_elements = await page.query_selector_all('a[href*="/maps/place/"]')
        place_links = []
        for elem in place_elements:
            href = await elem.get_attribute("href")
            if href:
                place_links.append(href)

        # Remove duplicates
        place_links = list(set(place_links))
        context.log.info(f"Found {len(place_links)} place links. Adding to queue...")

        # Enqueue up to 80 places for parallel detailed crawling
        for link in place_links[:80]:
            place_id = "unknown"
            if "/place/" in link:
                place_id = link.split("/place/")[1].split("/")[0]

            await context.add_requests([
                Request.from_url(link, label="DETAIL", user_data={"place_id": place_id})
            ])

    @router.handler("DETAIL")
    async def detail_handler(context: PlaywrightCrawlingContext) -> None:
        page = context.page
        link = context.request.url
        place_id = context.request.user_data.get("place_id", "unknown")
        
        context.log.info(f"Visiting place details: {link}")
        try:
            # Visit place details (fail fast if slow)
            await page.goto(link, wait_until="domcontentloaded", timeout=12000)
            await page.wait_for_selector('h1', timeout=3000)
            
            # Business Name
            name_elem = await page.query_selector('h1')
            name = await name_elem.inner_text() if name_elem else "Desconocido"

            # Category
            category_elem = await page.query_selector('button[jsaction*="pane.rating.category"]')
            category = await category_elem.inner_text() if category_elem else args.category

            # Phone Number
            phone = None
            phone_elem = await page.query_selector('button[data-item-id^="phone:tel:"]')
            if phone_elem:
                phone_raw = await phone_elem.get_attribute("data-item-id")
                if phone_raw:
                    phone = phone_raw.replace("phone:tel:", "").strip()

            # Website
            website = None
            website_elem = await page.query_selector('a[data-item-id="authority"]')
            if website_elem:
                website = await website_elem.get_attribute("href")

            # Address
            address = None
            address_elem = await page.query_selector('button[data-item-id="address"]')
            if address_elem:
                address = await address_elem.inner_text()
                if address:
                    address = address.replace("", "").replace("\n", " ").strip()

            # Coordinates from URL
            lat = None
            lon = None
            current_url = page.url
            if "@" in current_url:
                parts = current_url.split("@")[1].split(",")
                if len(parts) >= 2:
                    try:
                        lat = float(parts[0])
                        lon = float(parts[1])
                    except ValueError:
                        pass

            if lat is None or lon is None:
                lat = args.latitude
                lon = args.longitude

            # Evaluate website (real website vs social networks/directories)
            has_website = False
            social_link = None
            if website:
                if is_real_custom_website(website):
                    has_website = True
                else:
                    social_link = website
                    # Since it is just a social network profile, we treat the lead as having NO website
                    # so that it remains a qualified prospect.
                    website = None

            lead = {
                "external_id": f"googlemaps_{place_id}",
                "osm_type": "googlemaps",
                "osm_id": place_id,
                "business_name": name,
                "category": category,
                "address": address,
                "latitude": lat,
                "longitude": lon,
                "phone": phone,
                "website": website,
                "has_website": has_website,
                "city": "Lima",
                "country": "Perú",
                "raw_tags": {
                    "social_link": social_link,
                    "google_maps_url": link
                }
            }
            cell_results.append(lead)
        except Exception as ex:
            context.log.error(f"Error extracting details from link {link}: {ex}")

    # Configure PlaywrightCrawler with concurrency
    crawler = PlaywrightCrawler(
        request_handler=router,
        max_requests_per_crawl=150,
        max_request_retries=2,
        concurrency_settings=ConcurrencySettings(desired_concurrency=3),
        headless=True,
        browser_type="chromium"
    )
    await crawler.run([search_url])
    return cell_results


# ---------------------------------------------------------------------------
# Category aliases — used in "complete" mode to multiply result coverage
# ---------------------------------------------------------------------------

CATEGORY_ALIASES = {
    "todos los negocios": ["negocios", "locales comerciales", "tiendas", "servicios", "comercios"],
    "restaurantes":  ["restaurante", "restaurant", "cevichería", "pollería",
                      "picantería", "comida", "chifa", "almuerzo"],
    "barberias":     ["barbería", "barber shop", "peluquería", "salón de belleza"],
    "veterinarias":  ["veterinaria", "veterinary", "clínica veterinaria", "pet shop"],
    "talleres":      ["taller mecánico", "mecánica automotriz", "taller automotriz", "mecánico"],
    "ferreterias":   ["ferretería", "materiales de construcción", "distribuidora"],
    "consultorios":  ["consultorio médico", "clínica", "médico", "centro médico", "policlínico"],
}


GRID_ZOOMS = [14, 15]   # two zoom levels per cell — each shows a different result set


# ---------------------------------------------------------------------------
# Search Category Normalizer
# ---------------------------------------------------------------------------

def normalize_category(cat_str: str) -> str:
    if not cat_str:
        return ""
    # Strip spaces and convert to lowercase
    s = cat_str.strip().lower()
    # Normalize accents/diacritics: e.g. á -> a, í -> i
    s = "".join(
        c for c in unicodedata.normalize('NFKD', s)
        if not unicodedata.combining(c)
    )
    # Map singulars and abbreviations to primary plural keys
    singular_to_plural = {
        "barberia": "barberias",
        "barber shop": "barberias",
        "peluqueria": "barberias",
        "salon de belleza": "barberias",
        "restaurante": "restaurantes",
        "restaurant": "restaurantes",
        "cevicherian": "restaurantes",
        "comida": "restaurantes",
        "veterinaria": "veterinarias",
        "pet shop": "veterinarias",
        "taller": "talleres",
        "taller mecanico": "talleres",
        "mecanico": "talleres",
        "ferreteria": "ferreterias",
        "consultorio": "consultorios",
        "clinica": "consultorios",
        "medico": "consultorios",
        "todo los negocio": "todos los negocios",
        "todo los negocios": "todos los negocios",
        "todo": "todos los negocios",
        "todos": "todos los negocios"
      }
    if s in singular_to_plural:
        s = singular_to_plural[s]
    return s


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(description="Google Maps Scraper")
    parser.add_argument("--category", required=True, help="Category to search")
    parser.add_argument("--latitude", type=float, required=True, help="Latitude")
    parser.add_argument("--longitude", type=float, required=True, help="Longitude")
    parser.add_argument("--radius", type=float, default=3.0, help="Radius in km")
    parser.add_argument("--grid", action="store_true", default=False,
                        help="Enable grid search mode (multiple cells across the area)")
    parser.add_argument("--mode", choices=["basic", "complete"], default="basic",
                        help="basic = single term + double zoom | complete = all aliases + double zoom")
    args = parser.parse_args()

    # Apply search normalizer
    normalized_cat = normalize_category(args.category)

    all_results = []
    seen_ids: set = set()

    if args.grid:
        # --- GRID MODE ---
        grid_size = detect_grid_size(args.latitude, args.longitude)
        
        # Determine zooms and grid density based on mode
        if args.mode == "complete":
            # Spacing of 100 meters (0.10 km) to match single block size at zoom 18z
            # grid_size = diameter / spacing = (radius * 2) / 0.10
            grid_size = max(int((args.radius * 2) / 0.10), 8)
            zooms = [15, 16, 17, 18]         # Zoom in extremely close (block level)
            search_terms = CATEGORY_ALIASES.get(normalized_cat, [args.category])
        else:
            zooms = [14, 15]
            search_terms = [CATEGORY_ALIASES.get(normalized_cat, [args.category])[0]]





        grid_points = generate_grid_points(args.latitude, args.longitude, args.radius, grid_size)
        total_cells = len(grid_points)

        # Total searches = cells × zooms × terms
        total_searches = total_cells * len(zooms) * len(search_terms)

        sys.stderr.write(
            f"[Grid] mode={args.mode} | {total_cells} cells (grid_size={grid_size}) | "
            f"{len(zooms)} zooms | {len(search_terms)} terms | "
            f"{total_searches} total searches\n"
        )
        sys.stderr.flush()

        completed_searches = 0

        for idx, (cell_lat, cell_lon) in enumerate(grid_points):
            for term in search_terms:
                for zoom in zooms:
                    search_url = (
                        f"https://www.google.com/maps/search/"
                        f"{term}/@{cell_lat},{cell_lon},{zoom}z?hl=es"
                    )

                    sys.stderr.write(
                        f"[Grid] Cell {idx+1}/{total_cells} | zoom={zoom}z | term='{term}'\n"
                    )
                    sys.stderr.flush()

                    cell_results = await scrape_single_cell(term, search_url, args)

                    new_count = 0
                    for lead in cell_results:
                        eid = lead.get("external_id", "")
                        if eid not in seen_ids:
                            seen_ids.add(eid)
                            all_results.append(lead)
                            new_count += 1

                    completed_searches += 1

                    # Emit progress marker: current_search / total_searches / total_unique_leads
                    print(f"--- CELL_PROGRESS {completed_searches}/{total_searches} {len(all_results)} ---", flush=True)

                    # Shorter delay between zooms of the same cell
                    is_last = (completed_searches == total_searches)
                    if not is_last:
                        delay = random.uniform(2.0, 3.5) if zoom != zooms[-1] else random.uniform(3.0, 6.0)
                        sys.stderr.write(f"[Grid] Waiting {delay:.1f}s...\n")
                        sys.stderr.flush()
                        await asyncio.sleep(delay)


    else:
        # --- SINGLE MODE (no grid) ---
        term = CATEGORY_ALIASES.get(normalized_cat, [args.category])[0]
        search_url = (
            f"https://www.google.com/maps/search/"
            f"{term}/@{args.latitude},{args.longitude},14z?hl=es"
        )

        single_results = await scrape_single_cell(term, search_url, args)
        for lead in single_results:
            eid = lead.get("external_id", "")
            if eid not in seen_ids:
                seen_ids.add(eid)
                all_results.append(lead)

    # Emit final JSON output
    print("--- JSON_START ---", flush=True)
    print(json.dumps(all_results, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
