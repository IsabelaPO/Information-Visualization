const isValidString = (str) =>
  str && typeof str === "string" && str.trim() !== "";

const countryToContinent = {
    "Afghanistan": "Asia", "Albania": "Europe", "Algeria": "Africa", "Andorra": "Europe", "Angola": "Africa",
    "Argentina": "South America", "Armenia": "Asia", "Australia": "Oceania", "Austria": "Europe", "Azerbaijan": "Asia",
    "Bahamas": "North America", "Bahrain": "Asia", "Bangladesh": "Asia", "Barbados": "North America", "Belarus": "Europe",
    "Belgium": "Europe", "Belize": "North America", "Benin": "Africa", "Bermuda": "North America", "Bhutan": "Asia",
    "Bolivia": "South America", "Bosnia and Herzegovina": "Europe", "Botswana": "Africa", "Brazil": "South America",
    "Brunei": "Asia", "Bulgaria": "Europe", "Burkina Faso": "Africa", "Cambodia": "Asia", "Cameroon": "Africa",
    "Canada": "North America", "Cayman Islands": "North America", "Chile": "South America", "China": "Asia",
    "Colombia": "South America", "Congo": "Africa", "Costa Rica": "North America", "Croatia": "Europe", "Cuba": "North America",
    "Cyprus": "Asia", "Czech Republic": "Europe", "Denmark": "Europe", "Dominican Republic": "North America",
    "Ecuador": "South America", "Egypt": "Africa", "El Salvador": "North America", "Estonia": "Europe", "Ethiopia": "Africa",
    "Faroe Islands": "Europe", "Finland": "Europe", "France": "Europe", "Georgia": "Asia", "Germany": "Europe",
    "Ghana": "Africa", "Greece": "Europe", "Guatemala": "North America", "Hong Kong": "Asia", "Hungary": "Europe",
    "Iceland": "Europe", "India": "Asia", "Indonesia": "Asia", "Iran": "Asia", "Iraq": "Asia", "Ireland": "Europe",
    "Israel": "Asia", "Italy": "Europe", "Jamaica": "North America", "Japan": "Asia", "Jordan": "Asia",
    "Kazakhstan": "Asia", "Kenya": "Africa", "Kuwait": "Asia", "Kyrgyzstan": "Asia", "Latvia": "Europe",
    "Lebanon": "Asia", "Libya": "Africa", "Liechtenstein": "Europe", "Lithuania": "Europe", "Luxembourg": "Europe",
    "Malawi": "Africa", "Malaysia": "Asia", "Malta": "Europe", "Mauritius": "Africa", "Mexico": "North America",
    "Moldova": "Europe", "Monaco": "Europe", "Mongolia": "Asia", "Montenegro": "Europe", "Morocco": "Africa",
    "Namibia": "Africa", "Nepal": "Asia", "Netherlands": "Europe", "New Zealand": "Oceania", "Nicaragua": "North America",
    "Nigeria": "Africa", "North Macedonia": "Europe", "Norway": "Europe", "Pakistan": "Asia", "Palestine": "Asia",
    "Panama": "North America", "Paraguay": "South America", "Peru": "South America", "Philippines": "Asia",
    "Poland": "Europe", "Portugal": "Europe", "Puerto Rico": "North America", "Qatar": "Asia", "Romania": "Europe",
    "Russia": "Europe", "Saudi Arabia": "Asia", "Senegal": "Africa", "Serbia": "Europe", "Singapore": "Asia",
    "Slovakia": "Europe", "Slovenia": "Europe", "South Africa": "Africa", "South Korea": "Asia", "Spain": "Europe",
    "Sri Lanka": "Asia", "Sweden": "Europe", "Switzerland": "Europe", "Syria": "Asia", "Taiwan": "Asia",
    "Tanzania": "Africa", "Thailand": "Asia", "Trinidad and Tobago": "North America", "Tunisia": "Africa", "Turkey": "Asia",
    "Uganda": "Africa", "Ukraine": "Europe", "United Arab Emirates": "Asia", "United Kingdom": "Europe",
    "United States": "North America", "Uruguay": "South America", "Uzbekistan": "Asia", "Venezuela": "South America",
    "Vietnam": "Asia", "Yugoslavia": "Europe", "Zimbabwe": "Africa"
};
//stores all platform data
let allPlatformData = [];
let tooltip; // Tooltip is defined once globally
firstRender = true;
// Add this line near where you define `currentFilters`
let treemapCurrentView = 'Continents'; // Tracks the current view level
let continentToCountriesMap = {};
let currentLocationView = 'Continents'; // Tracks the active filter list view
//sets platform colors
const platformColors = {
  Netflix: "#E50914",
  Amazon: "#FF9900",
  Disney: "#113CCF",
  HBO: "#9068F4",
  Paramount: "#0090FF",
  Apple: "#A2AAAD",
};

const typeFilterColors = {
  SHOW: "#228B22",
  MOVIE: "#015034ff",
};

// A constant to hold the default filter state for easy resetting ---
//how filters look in the dashboard initially
const defaultFilters = {
  type: [],
  imdbRange: [1.0, 10.0],
  selectedGenres: [],
  yearRange: null,
  selectedAudiences: [],
  selectedPlatforms: [],
  selectedCountries: [],
};

//apply the initial to the current filters
//where the filters are saved when changed
let currentFilters = { ...defaultFilters };

// Variables to hold our slider instances so we can reset them ---
let imdbSlider, yearSlider;
//loads the csv files with d3
document.addEventListener("DOMContentLoaded", () => {
  Promise.all([d3.csv("streaming_platforms.csv")])
    .then(([rawPlatformData]) => {
      const processedPlatformData = rawPlatformData.map((d) => ({
        ...d,
        streaming_platform: d.streaming_platform,
        release_year: +d.release_year,
        imdb_score: +d.imdb_score,
        type: d.type,
        genres: d.genres || "",
        age_category: d.age_category || "Unknown",
        main_genre: isValidString(d.genres)
          ? d.genres.split(",")[0].trim()
          : "Unknown",
        countries: isValidString(d.country_full_name)
          ? d.country_full_name.split(",").map((c) => c.trim())
          : [],
      }));

      //stores the processed data
      allPlatformData = processedPlatformData;
      
      const allCountriesInData = Array.from(new Set(
        allPlatformData.flatMap(d => d.countries).filter(c => {
        return (
          c !== 'XC' && 
          c !== 'YU' && 
          c !== 'Republic of' && 
          c !== 'Islamic Republic of' && 
          c !== 'Bolivarian Republic of' && 
          c !== 'Federated States of' && 
          c !== 'Plurinational State of'
                );
              })
            )
          );
      
      currentFilters.selectedCountries = [...allCountriesInData];

      allCountriesInData.forEach(country => {
        const continent = countryToContinent[country];
        if (continent) {
            if (!continentToCountriesMap[continent]) {
                continentToCountriesMap[continent] = [];
            }
            continentToCountriesMap[continent].push(country);
        }
      });

      tooltip = d3
        .select("body")
        .selectAll(".tooltip-donut")
        .data([0])
        .join("div")
        .attr("class", "tooltip-donut")
        .style("position", "absolute")
        .style("opacity", 0);

      document.getElementById("loading").style.display = "none";

      //initializes all filters and sliders
      setupPlatformFilter();
      setupContentTypeFilter();
      populateGenreFilter(allPlatformData);
      setupGenreFilter();
      //imdbSlider = setupImdbSlider();
      yearSlider = setupYearSlider(allPlatformData);
      setupAudienceFilter();
      setupLocationFilter(allPlatformData);
      setupRemoveFiltersButton();

      //draws initial visualizations
      renderAllVisualizations(allPlatformData);

      // --- ADD THIS LINE ---
      // This syncs the UI with the initial "all selected" state.
      applyFilters(); 

      window.addEventListener("resize", () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(
          () => renderAllVisualizations(allPlatformData),
          250
        );
      });
    })
    .catch((error) => console.error("Data loading failed:", error));
});

function toggleFilters() {
  const panel = document.getElementById("filters-panel");

  if (!panel.classList.contains("visible")) {
    // --- OPEN PANEL ---
    panel.style.display = "block";

    requestAnimationFrame(() => {
      panel.classList.add("visible");
      panel.classList.remove("hidden");
    });

    const closeButton = panel.querySelector("#close-filters-btn");
    if (closeButton) {
      closeButton.onclick = () => toggleFilters();
    }
    imdbSlider = setupImdbSlider();

  } else {
    // --- CLOSE PANEL ---
    panel.classList.add("hidden");
    panel.classList.remove("visible");

    panel.addEventListener(
      "transitionend",
      () => {
        if (panel.classList.contains("hidden")) {
          panel.style.display = "none";
        }
      },
      { once: true }
    );
  }
}



function renderAllVisualizations(data) {
  renderSankeyChart(data, true);
  renderQuantityChart(data);
  renderTreemapChart(data);
}

function setupLocationFilter(data) {
    const allCountries = Array.from(new Set(data.flatMap(d => d.countries).filter(c => c 
      && c !== "" && c !== 'XC' && c != 'YU' && c !== 'Republic of' && c !== 'Islamic Republic of' 
      && c !== 'Bolivarian Republic of' && c !== 'Federated States of' && c !== 'Plurinational State of'))).sort();
    const allContinents = Object.keys(continentToCountriesMap).sort();

    // 1. Populate the Country list with checkboxes
    d3.select("#country-filter-list")
      .selectAll("div.list-item-container")
      .data(allCountries, d => d)
      .join("div")
      .attr("class", "list-item-container")
      .html(d => `<label><input type="checkbox" class="filter-checkbox"> ${d}</label>`)
      .select("input")
      .on("change", function(event, d) {
          if (this.checked) {
              if (!currentFilters.selectedCountries.includes(d)) {
                  currentFilters.selectedCountries.push(d);
              }
          } else {
              const index = currentFilters.selectedCountries.indexOf(d);
              if (index > -1) {
                  currentFilters.selectedCountries.splice(index, 1);
              }
          }
          applyFilters();
      });

    // 2. Populate the Continent list with checkboxes
    d3.select("#continent-filter-list")
      .selectAll("div.list-item-container")
      .data(allContinents, d => d)
      .join("div")
      .attr("class", "list-item-container")
      .html(d => `<label><input type="checkbox" class="filter-checkbox"> ${d}</label>`)
      .select("input")
      .on("change", function(event, d) {
          const countriesInContinent = continentToCountriesMap[d] || [];
          if (this.checked) {
              // Add all countries from this continent that aren't already selected
              countriesInContinent.forEach(c => {
                  if (!currentFilters.selectedCountries.includes(c)) {
                      currentFilters.selectedCountries.push(c);
                  }
              });
          } else {
              // Remove all countries from this continent
              currentFilters.selectedCountries = currentFilters.selectedCountries.filter(c => !countriesInContinent.includes(c));
          }
          applyFilters();
      });

    // 3. Setup Toggle Buttons (This part remains unchanged)
    d3.select("#view-countries-btn").on("click", function() {
        d3.select("#country-view-container").style("display", "block");
        d3.select("#continent-view-container").style("display", "none");
        d3.select(this).classed("active", true);
        d3.select("#view-continents-btn").classed("active", false);
        currentLocationView = 'Countries';
        d3.select("#country-continent-search")
        .property("placeholder", "Search countries...");
        applyFilters();
    });

    d3.select("#view-continents-btn").on("click", function() {
        d3.select("#continent-view-container").style("display", "block");
        d3.select("#country-view-container").style("display", "none");
        d3.select(this).classed("active", true);
        d3.select("#view-countries-btn").classed("active", false);
        currentLocationView = 'Continents';
        d3.select("#country-continent-search")
        .property("placeholder", "Search continents...");
        applyFilters();
    });

    // 4. Setup "Select/Deselect All" Buttons (This part remains unchanged)
    d3.select("#select-all-countries").on("click", function() {
        const allCountryNames = d3.selectAll("#country-filter-list .list-item-container").data();
        if (currentFilters.selectedCountries.length === allCountryNames.length) {
            currentFilters.selectedCountries = [];
        } else {
            currentFilters.selectedCountries = [...allCountryNames];
        }
        applyFilters();
    });

    d3.select("#select-all-continents").on("click", function() {
        const allCountryNames = d3.selectAll("#country-filter-list .list-item-container").data();
        if (currentFilters.selectedCountries.length === allCountryNames.length) {
            currentFilters.selectedCountries = [];
        } else {
            currentFilters.selectedCountries = [...allCountryNames];
        }
        applyFilters();
    });
}

function applyFilters() {
  let filteredPlatformData = allPlatformData;
  console.log(currentFilters.selectedGenres);

  if (currentFilters.selectedPlatforms.length > 0) {
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.selectedPlatforms.includes(d.streaming_platform)
    );

    d3.selectAll(".platform-buttons button")
      .classed("active", (d, i, nodes) =>
        currentFilters.selectedPlatforms.includes(nodes[i].innerText)
      )
      .classed("inactive", (d, i, nodes) =>
        !currentFilters.selectedPlatforms.includes(nodes[i].innerText)
      );
  }

  if (currentFilters.type.length > 0) {
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.type.includes(d.type)
    );
    
    d3.selectAll(".content-type-filter button")
      .classed("active", (d, i, nodes) =>
        currentFilters.type.includes(nodes[i].getAttribute("content-type-filter"))
      )
      .classed("inactive", (d, i, nodes) =>
        !currentFilters.type.includes(nodes[i].getAttribute("content-type-filter"))
      );
  }

  filteredPlatformData = filteredPlatformData.filter(
    (d) =>
      d.imdb_score >= currentFilters.imdbRange[0] &&
      d.imdb_score <= currentFilters.imdbRange[1]
  );

  // if (currentFilters.selectedGenres.length > 0) {
  //   filteredPlatformData = filteredPlatformData.filter((d) =>
  //     currentFilters.selectedGenres.includes(d.main_genre)
  //   );

  //   d3.selectAll('#genre-filter-list input[type="checkbox"]')
  //     .property("checked", function() {
  //       const genre = this.parentNode.textContent.trim();
  //       return currentFilters.selectedGenres.includes(genre);
  //     });
  // }

  // Always filter by genre — if none are selected, result will be empty
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.selectedGenres.includes(d.main_genre)
    );

    // Sync checkbox states regardless
    d3.selectAll('#genre-filter-list input[type="checkbox"]')
      .property("checked", function() {
        const genre = this.parentNode.textContent.trim();
        return currentFilters.selectedGenres.includes(genre);
    });


  if (currentFilters.yearRange) {
    filteredPlatformData = filteredPlatformData.filter(
      (d) =>
        d.release_year >= currentFilters.yearRange[0] &&
        d.release_year <= currentFilters.yearRange[1]
    );
  }

  if (currentFilters.selectedAudiences.length > 0) {
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.selectedAudiences.includes(d.age_category)
    );

    d3.selectAll(".audience-buttons button")
      .classed("active", (d, i, nodes) =>
        currentFilters.selectedAudiences.includes(nodes[i].getAttribute("audience-buttons"))
      )
      .classed("inactive", (d, i, nodes) =>
        !currentFilters.selectedAudiences.includes(nodes[i].getAttribute("audience-buttons"))
      );
  }

  if (currentFilters.selectedCountries.length > 0) {
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.selectedCountries.some((country) =>
        d.countries.includes(country)
      )
    );
  }

  const allCountryNames = d3.selectAll("#country-filter-list .list-item-container").data();
  
  // Sync country checkboxes
  d3.select("#country-filter-list").selectAll("input.filter-checkbox")
    .property("checked", d => currentFilters.selectedCountries.includes(d));
  
  // Sync country "Select All" button text
  d3.select("#select-all-countries").text(
      currentFilters.selectedCountries.length === allCountryNames.length ? "Deselect All" : "Select All"
  );

  // Sync continent checkboxes
  d3.select("#continent-filter-list").selectAll("input.filter-checkbox")
    .property("checked", d => {
        const countriesInContinent = continentToCountriesMap[d] || [];
        // A continent is "checked" if all its countries are selected
        return countriesInContinent.length > 0 && countriesInContinent.every(c => currentFilters.selectedCountries.includes(c));
    })
    .property("indeterminate", d => { 
        const countriesInContinent = continentToCountriesMap[d] || [];
        const selectedCount = countriesInContinent.filter(c => currentFilters.selectedCountries.includes(c)).length;
        
        // A continent is "indeterminate" (visually selected/dashed) if 
        // some (selectedCount > 0) but not all (selectedCount < total) are selected.
        return selectedCount > 0 && selectedCount < countriesInContinent.length;
    });

  // Sync continent "Select All" button text
  d3.select("#select-all-continents").text(
      currentFilters.selectedCountries.length === allCountryNames.length ? "Deselect All" : "Select All"
  );

  renderAllVisualizations(filteredPlatformData);
}

function setupRemoveFiltersButton() {
  d3.select(".remove-filters-btn").on("click", () => {
    // 1. Reset the state object
    currentFilters = { ...defaultFilters };

    // Re-select all countries, which is the default state
    treemapCurrentView = 'Continents';
    currentLocationView = 'Continents'; 
    d3.select("#country-continent-search")
        .property("placeholder", "Search continents...");
    const allCountryNames = d3.selectAll("#country-filter-list .list-item-container").data().map(d => d);
    currentFilters.selectedCountries = [...allCountryNames];
    d3.select("#continent-view-container").style("display", "block");
    d3.select("#country-view-container").style("display", "none");
    d3.select("#view-continents-btn").classed("active", true);
    d3.select("#view-countries-btn").classed("active", false);

    
    const allGenres = [];
    d3.selectAll('#genre-filter-list input[type="checkbox"]').each(function () {
      allGenres.push(d3.select(this.parentNode).text().trim());
    });
    currentFilters.selectedGenres = allGenres;    
    
    // 2. Reset the other UI controls
    d3.selectAll(
      ".content-type-filter button, .platform-buttons button, .audience-buttons button"
    )
      .classed("active", false)
      .classed("inactive", false);
    d3.selectAll('#genre-filter-list input[type="checkbox"]').property(
      "checked",
      true
    );

    d3.selectAll(".country-list-item").style("display", "block");

    // Reset the sliders
    if (imdbSlider) imdbSlider.reset();
    if (yearSlider) yearSlider.reset();

    // 3. Apply filters, which will now handle the visual update
    applyFilters();
  });
}
function setupPlatformFilter() {
  //assigns colors to the platform buttons
  d3.selectAll(".platform-buttons button").each(function () {
    const platform = d3.select(this).attr("data-platform");
    if (platformColors[platform]) {
      d3.select(this).style("background-color", platformColors[platform]);
    }
  });
  //when a button is clicked, it toggles to active class (for css)
  d3.selectAll(".platform-buttons button").on("click", function () {
    const button = d3.select(this);
    //visually marks the button as selected/unselected
    button.classed("active", !button.classed("active"));
    //iterates through active buttons, collects values into selected array
    //saves the array into currentFilters
    const selected = [];
    d3.selectAll(".platform-buttons button.active").each(function () {
      selected.push(d3.select(this).attr("data-platform"));
    });

    currentFilters.selectedPlatforms = selected;
    const anyFilterActive = selected.length > 0;
    d3.selectAll(".platform-buttons button").each(function () {
      const btn = d3.select(this);
      const platform = btn.attr("data-platform");
      //if one platform is active keep those selected as "active" and
      //mark all non-selected buttons as "inactive"
      if (anyFilterActive) {
        const isActive = selected.includes(platform);
        btn.classed("active", isActive);
        btn.classed("inactive", !isActive);
      } else {
        //If no platform is selected clear both "active" and "inactive" classes
        btn.classed("active", false);
        btn.classed("inactive", false);
      }
    });
    applyFilters();
  });
}

function setupAudienceFilter() {
  //when a button is clicked, it toggles to active class (for css)
  d3.selectAll(".audience-buttons button").on("click", function () {
    const button = d3.select(this);

    //visually marks the button as selected/unselected
    button.classed("active", !button.classed("active"));
    //iterates through active buttons, collects values into selected array
    //saves the array into currentFilters
    const selected = [];
    d3.selectAll(".audience-buttons button.active").each(function () {
      selected.push(d3.select(this).attr("audience-buttons"));
    });
    currentFilters.selectedAudiences = selected;
    const anyFilterActive = selected.length > 0;
    d3.selectAll(".audience-buttons button").each(function () {
      const btn = d3.select(this);
      const audience = btn.attr("audience-buttons");
      //if one platform is active keep those selected as "active" and
      //mark all non-selected buttons as "inactive"
      if (anyFilterActive) {
        const isActive = selected.includes(audience);
        btn.classed("active", isActive);
        btn.classed("inactive", !isActive);
      } else {
        //If no platform is selected clear both "active" and "inactive" classes
        btn.classed("active", false);
        btn.classed("inactive", false);
      }
    });
    applyFilters();
  });
}

function setupContentTypeFilter() {
  d3.selectAll(".content-type-filter button").each(function () {
    const type = d3.select(this).attr("content-type-filter");
    if (typeFilterColors[type]) {
      d3.select(this).style("background-color", typeFilterColors[type]);
    }
  });

  d3.selectAll(".content-type-filter button").on("click", function () {
    const button = d3.select(this);
    //visually marks the button as selected/unselected
    button.classed("active", !button.classed("active"));
    const selected = [];
    d3.selectAll(".content-type-filter button.active").each(function () {
      selected.push(d3.select(this).attr("content-type-filter"));
    });
    currentFilters.type = selected;
    const anyFilterActive = selected.length > 0;
    d3.selectAll(".content-type-filter button").each(function () {
      const btn = d3.select(this);
      const typeaux = btn.attr("content-type-filter");
      if (anyFilterActive) {
        const isActive = selected.includes(typeaux);
        btn.classed("active", isActive);
        btn.classed("inactive", !isActive);
      } else {
        btn.classed("active", false);
        btn.classed("inactive", false);
      }
    });
    applyFilters();
  });
}

function createD3RangeSlider(config) {
  //select container and clear previous content
  const container = d3.select(config.containerId);
  container.selectAll("*").remove();
  // Define margins and calculate inner width/height for the slider area
  const margin = { top: 10, right: 15, bottom: 20, left: 15 };
  const width =
    container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 50 - margin.top - margin.bottom;
  // Create the SVG element and group for the slider
  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Define a linear scale from domain (min/max values) → pixel range
  // clamp(true) ensures values can’t go outside the domain
  const xScale = d3
    .scaleLinear()
    .domain(config.domain)
    .range([0, width])
    .clamp(true);

  // Create tooltip element (hidden initially)
  const tooltip = container
    .append("div")
    .attr("class", "slider-tooltip")
    .style("position", "fixed")
    .style("padding", "4px 8px")
    .style("background", "rgba(0, 0, 0, 0.7)")
    .style("color", "white")
    .style("font-size", "12px")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("z-index", 1000);

  // Draw the bottom axis with ticks and formatting
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height})`)
    .call(
      d3
        .axisBottom(xScale)
        .ticks(config.ticks || 5)
        .tickFormat(config.tickFormat)
    );
  // Create the brush (draggable selection box) across the x-axis
  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, height],
    ])
    .on("brush", (event) => {
      if (!event.selection) return;
      const [x0, x1] = event.selection.map(xScale.invert);

        const src = event.sourceEvent;
        const clientX = src ? (src.touches ? src.touches[0].clientX : src.clientX) : 0;
        const clientY = src ? (src.touches ? src.touches[0].clientY : src.clientY) : 0;
      // Show tooltip and update its position/value
      const [mouseX, mouseY] = d3.pointer(event, container.node());
      tooltip
        .style("opacity", 1)
        // .style("left", `${mouseX + 10}px`)
        // .style("top", `${mouseY - 25}px`)
        .style("left", `${clientX}px`)
        .style("top", `${clientY}py`)
        .text(`${config.tickFormat(x0)} - ${config.tickFormat(x1)}`);
    })
    .on("end", (event) => {
      tooltip.transition().duration(200).style("opacity", 0);
      // When user stops dragging, convert pixel coords back into data values
      let valueRange = event.selection
        ? event.selection.map(xScale.invert)
        : config.domain;
      config.onBrushEnd(valueRange);
    });

  const gBrush = svg.append("g").attr("class", "brush").call(brush);

  const initialRange = config.initialRange || config.domain;
  gBrush.call(brush.move, initialRange.map(xScale));
  //gBrush.call(brush.move, config.domain.map(xScale));

  // Update the min/max labels outside the slider with formatted values
  d3.select(config.minLabelId).text(config.tickFormat(config.domain[0]));
  d3.select(config.maxLabelId).text(config.tickFormat(config.domain[1]));

  // Return an object with a reset method
  const transitionDuration = 750; // Set transition time for smoothness

  // Return an object with a reset method
  return {
    reset: () => {
      const minYear = config.domain[0];
      const maxYear = config.domain[1];

      // 1. Smoothly move the brush handles (slider selection)
      // Applying transition before call(brush.move, ...) makes the handles move smoothly.
      gBrush
        .transition()
        .duration(transitionDuration)
        .call(brush.move, config.domain.map(xScale));

      // 2. Smoothly transition the minimum year label (text content)
      d3.select(config.minLabelId)
        .transition()
        .duration(transitionDuration)
        .tween("text", function() {
          const i = d3.interpolateRound(+this.textContent, minYear);
          return function(t) {
            this.textContent = i(t);
          };
        });

      // 3. Smoothly transition the maximum year label (text content)
      d3.select(config.maxLabelId)
        .transition()
        .duration(transitionDuration)
        .tween("text", function() {
          const i = d3.interpolateRound(+this.textContent, maxYear);
          return function(t) {
            this.textContent = i(t);
          };
        });
    },
  };
}

function setupYearSlider(data) {
  const yearData = data.filter((d) => d.release_year);
  const yearExtent = d3.extent(yearData, (d) => d.release_year);
  const slider = createD3RangeSlider({
    containerId: "#year-slider-container",
    minLabelId: "#year-min-value",
    maxLabelId: "#year-max-value",
    domain: yearExtent,
    tickFormat: d3.format("d"),
    //initialRange: currentFilters.yearRange || [1.0, 10.0],
    onBrushEnd: (range) => {
      const roundedRange = [Math.round(range[0]), Math.round(range[1])];
      if (
        JSON.stringify(currentFilters.yearRange) !==
        JSON.stringify(roundedRange)
      ) {
        currentFilters.yearRange =
          roundedRange[0] === yearExtent[0] && roundedRange[1] === yearExtent[1]
            ? null
            : roundedRange;
        applyFilters();
      }
    },
  });

  // Set the min and max labels
  d3.select("#year-min-value").text(yearExtent[0]);
  d3.select("#year-max-value").text(yearExtent[1]);

  return slider;
}

function setupImdbSlider() {
  const slider = createD3RangeSlider({
    containerId: "#imdb-slider-container",
    domain: [1.0, 10.0],
    tickFormat: d3.format(".1f"),
    showTickLabels: true, // show labels along ticks
    initialRange: currentFilters.imdbRange || [1.0, 10.0],
    onBrushEnd: (range) => {
      const formattedRange = [
        parseFloat(range[0].toFixed(1)),
        parseFloat(range[1].toFixed(1)),
      ];
      currentFilters.imdbRange = formattedRange;
      applyFilters();
    },
  });

  // Remove the max tick label
  d3.select("#imdb-slider-container")
    .selectAll(".tick text")
    .filter((d) => d === 10) // filter the max value
    .text(""); // remove its text

  return slider;
}
function setupGenreFilter() {
  // Existing logic for individual checkbox change
  d3.selectAll('#genre-filter-list input[type="checkbox"]').on("change", () => {
    const selected = [];
    d3.selectAll('#genre-filter-list input[type="checkbox"]:checked').each(function () {
      selected.push(d3.select(this.parentNode).text().trim());
    });
    currentFilters.selectedGenres = selected;

    // Update button text dynamically based on selection
    const allSelected = d3.selectAll('#genre-filter-list input[type="checkbox"]:not(:checked)').empty();
    d3.select("#select-all-genres").text(allSelected ? "Deselect All" : "Select All");

    applyFilters();
  });

  // --- TOGGLE LOGIC FOR "SELECT ALL / DESELECT ALL" BUTTON ---
  d3.select("#select-all-genres").on("click", function () {
    const button = d3.select(this);
    const allSelected = d3.selectAll('#genre-filter-list input[type="checkbox"]:not(:checked)').empty();

    if (allSelected) {
      // All are currently checked → uncheck all
      d3.selectAll('#genre-filter-list input[type="checkbox"]').property("checked", false);
      currentFilters.selectedGenres = [];
      button.text("Select All");
    } else {
      // Not all are checked → select all
      d3.selectAll('#genre-filter-list input[type="checkbox"]').property("checked", true);
      const allGenres = [];
      d3.selectAll('#genre-filter-list input[type="checkbox"]').each(function () {
        allGenres.push(d3.select(this.parentNode).text().trim());
      });
      currentFilters.selectedGenres = allGenres;
      button.text("Deselect All");
    }
    applyFilters();
  });
  //applyFilters();
}


function populateGenreFilter(data) {
  const genres = new Set(
    data.flatMap((d) =>
      isValidString(d.genres) ? d.genres.split(",").map((g) => g.trim()) : []
    )
  );
  
  currentFilters.selectedGenres = [...genres];

  d3.select("#genre-filter-list")
    .selectAll("div")
    .data(Array.from(genres).sort())
    .enter()
    .append("div")
    .html(
      (d) =>
        `<label style="display: flex; align-items: center; cursor: pointer; font-weight: normal;"><input type="checkbox" style="margin-right: 0.5rem;" checked>${d}</label>`
    );
}

function renderTimelineFilter(data) {
  const container = d3.select("#timeline-filter");
  container.selectAll("*").remove();
  const bounds = container.node().getBoundingClientRect();
  if (bounds.width < 10 || bounds.height < 10) return;
  const margin = { top: 30, right: 30, bottom: 40, left: 30 };
  const width = bounds.width - margin.left - margin.right;
  const height = bounds.height - margin.top - margin.bottom;
  const svg = container
    .append("svg")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const yearData = data.filter((d) => d.release_year);
  const yearExtent = d3.extent(yearData, (d) => d.release_year);
  if (!yearExtent[0] || !yearExtent[1]) return;
  const xScale = d3.scaleLinear().domain(yearExtent).range([0, width]);
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, height],
    ])
    .on("end", ({ selection }) => {
      if (!selection) return;
      const [x0, x1] = selection.map(xScale.invert);
      console.log("Selected years:", Math.round(x0), "-", Math.round(x1));
    });

  svg.append("g").attr("class", "brush").call(brush);
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-size", "1rem")
    .style("font-weight", "600")
    .style("fill", "#334155")
    .text("Filter by Release Year");
}

function populateCountryFilter(data) {
  const allCountries = new Set(
    data.flatMap((d) => d.countries).filter((c) => c && c !== "")
  );

  d3.select("#country-filter-list")
    .selectAll(".country-list-item")
    .data(Array.from(allCountries).sort(), (d) => d)
    .join("div")
    .attr("class", "country-list-item")
    .text((d) => d)
    .on("click", function (event, d) {
      const index = currentFilters.selectedCountries.indexOf(d);
      if (index > -1) {
        // If the country is already selected, remove it
        currentFilters.selectedCountries.splice(index, 1);
      } else {
        // Otherwise, add the country to the selection
        currentFilters.selectedCountries.push(d);
      }
      applyFilters();
    });
}
function setupCountryFilter(data) {
  populateCountryFilter(data);

  // This is your existing search input logic, leave it as is.
  d3.select("#country-search").on("input", function (event) {
    const searchTerm = event.target.value.toLowerCase();
    d3.selectAll(".country-list-item").style("display", function () {
      const countryName = d3.select(this).text().toLowerCase();
      return countryName.includes(searchTerm) ? "block" : "none";
    });
  });

  // --- Add this new code for the "Select All" button ---
  d3.select("#select-all-countries").on("click", function () {
    const button = d3.select(this);
    const allCountryItems = d3.selectAll(".country-list-item");
    
    // Get all country names from the data bound to the list items
    const allCountryNames = allCountryItems.data();

    // Check if every country is already in the current filter
    const areAllSelected = allCountryNames.length > 0 && allCountryNames.every(c => currentFilters.selectedCountries.includes(c));

    if (areAllSelected) {
      // If everything is selected, clear the selection
      currentFilters.selectedCountries = [];
      button.text("Select All");
    } else {
      // Otherwise, select all countries
      currentFilters.selectedCountries = [...allCountryNames];
      button.text("Deselect All");
    }
    
    // Trigger a re-render to update the visuals
    applyFilters();
  });
}

function renderQuantityChart(data) {
  const container = d3.select("#quantity-chart");
  // No longer removing everything, to allow for transitions

  const bounds = container.node().getBoundingClientRect();
  if (bounds.width < 10 || bounds.height < 10) return;

  const margin = { top: 40, right: 30, bottom: 40, left: 100 };
  const width = bounds.width - margin.left - margin.right;
  const height = bounds.height - margin.top - margin.bottom;

  const t = d3.transition().duration(750);

  // Use .join() to create the SVG canvas once
  //container.selectAll("svg").remove();
  const svg = container.selectAll("svg").data([null]).join(
    enter => enter
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`),
    update => update.select("g")
  );

  // Check if a single content type is selected
  const singleTypeSelected =
    currentFilters.type.length === 1 ? currentFilters.type[0] : null;

  const aggData = Array.from(
    d3.group(
      data.filter((d) => isValidString(d.streaming_platform)),
      (d) => d.streaming_platform
    ),
    ([platform, values]) => ({
      platform,
      tvShows: values.filter((d) => d.type === "SHOW").length,
      movies: values.filter((d) => d.type === "MOVIE").length,
    })
  );
  aggData.sort((a, b) => b.movies + b.tvShows - (a.movies + a.tvShows));

  const noDataMessage = svg
    .selectAll(".no-data-message")
    .data(aggData.length === 0 ? [1] : []);
  noDataMessage
    .enter()
    .append("text")
    .attr("class", "no-data-message")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("text-anchor", "middle")
    .text("No data available for the current filter selection.")
    .style("fill", "var(--muted-text)");
  noDataMessage.exit().transition(t).style("opacity", 0).remove();

  if (aggData.length === 0) {
    svg
      .selectAll(".tv-show-bar, .movie-bar, .bar, .center-line")
      .transition(t)
      .attr("width", 0)
      .attr("height", 0)
      .remove();
    return;
  }

  if (singleTypeSelected) {
    // --- A. ANIMATE TO NORMAL BAR CHART ---
    const dataType = singleTypeSelected === "SHOW" ? "tvShows" : "movies";

    svg
      .selectAll(".chart-title")
      .data([
        singleTypeSelected === "SHOW"
          ? "TV Show Quantities"
          : "Movie Quantities",
      ])
      .join("text")
      .attr("class", "chart-title")
      .attr("x", width / 2)
      .attr("y", -15)
      .attr("text-anchor", "middle")
      .style("font-size", "1rem")
      .style("font-weight", "600")
      .style("fill", "#334155")
      .text((d) => d);

    const xScale = d3
      .scaleBand()
      .domain(aggData.map((d) => d.platform))
      .range([0, width])
      .padding(0.2);
    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(aggData, (d) => d[dataType]) * 1.1])
      .range([height, 0]);

    svg
      .selectAll(".x-axis")
      .data([null])
      .join("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0, ${height})`)
      .transition(t)
      .call(d3.axisBottom(xScale));
    svg
      .selectAll(".y-axis")
      .data([null])
      .join("g")
      .attr("class", "axis y-axis")
      .transition(t)
      .call(d3.axisLeft(yScale).ticks(5));

    svg
      .selectAll(".tv-show-bar, .movie-bar, .center-line")
      .transition(t)
      .attr("width", 0)
      .style("opacity", 0)
      .remove();

    svg
      .selectAll(".bar")
      .data(aggData, (d) => d.platform)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("class", "bar")
            .attr("fill", typeFilterColors[singleTypeSelected])
            .attr("x", (d) => xScale(d.platform))
            .attr("y", height)
            .attr("width", xScale.bandwidth())
            .attr("height", 0)
            .call((enter) =>
              enter
                .transition(t)
                .attr("y", (d) => yScale(d[dataType]))
                .attr("height", (d) => height - yScale(d[dataType]))
            ),
        (update) =>
          update.call((update) =>
            update
              .transition(t)
              .attr("x", (d) => xScale(d.platform))
              .attr("width", xScale.bandwidth())
              .attr("y", (d) => yScale(d[dataType]))
              .attr("height", (d) => height - yScale(d[dataType]))
          ),
        (exit) =>
          exit.transition(t).attr("y", height).attr("height", 0).remove()
      )
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(50).style("opacity", 1);
        tooltip.html(
          `<div>${d.platform}</div><div>${singleTypeSelected}: ${d[dataType]}</div>`
        );
        const bbox = tooltip.node().getBoundingClientRect();
        tooltip
          .style("left", event.pageX - bbox.width / 2 + "px")
          .style("top", event.pageY - bbox.height - 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(50).style("opacity", 0);
      });
  } else {
    // --- B. ANIMATE TO BUTTERFLY CHART ---
    svg
      .selectAll(".chart-title")
      .data(["TV Shows vs. Movies"])
      .join("text")
      .attr("class", "chart-title")
      .attr("x", width / 2)
      .attr("y", -15)
      .attr("text-anchor", "middle")
      .style("font-size", "1rem")
      .style("font-weight", "600")
      .style("fill", "#334155")
      .text((d) => d);

    const maxVal = d3.max(aggData, (d) => Math.max(d.tvShows, d.movies)) * 1.1;
    const xScale = d3.scaleLinear().domain([-maxVal, maxVal]).range([0, width]);
    const yScale = d3
      .scaleBand()
      .domain(aggData.map((d) => d.platform))
      .range([0, height])
      .padding(0.4);

    svg
      .selectAll(".x-axis")
      .data([null])
      .join("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0, ${height})`)
      .transition(t)
      .call(d3.axisBottom(xScale).ticks(7).tickFormat(Math.abs));
    svg
      .selectAll(".y-axis")
      .data([null])
      .join("g")
      .attr("class", "axis y-axis")
      .transition(t)
      .call(d3.axisLeft(yScale));

    svg
      .selectAll(".bar")
      .transition(t)
      .attr("height", 0)
      .attr("y", height)
      .remove();

    svg
      .selectAll(".center-line")
      .data([null])
      .join("line")
      .attr("class", "center-line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#B0B0B0")
      .attr("stroke-width", 1)
      .style("opacity", 0) // Start transparent
      .transition(t)
      .style("opacity", 1)
      .attr("x1", xScale(0))
      .attr("x2", xScale(0));

    svg
      .selectAll(".tv-show-bar")
      .data(aggData, (d) => d.platform)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("class", "tv-show-bar")
            .attr("y", (d) => yScale(d.platform))
            .attr("height", yScale.bandwidth())
            .attr("fill", typeFilterColors.SHOW)
            .attr("x", xScale(0))
            .attr("width", 0)
            .call((enter) =>
              enter
                .transition(t)
                .attr("x", (d) => xScale(-d.tvShows))
                .attr("width", (d) => xScale(0) - xScale(-d.tvShows))
            ),
        (update) =>
          update
            .transition(t)
            .attr("y", (d) => yScale(d.platform))
            .attr("height", yScale.bandwidth())
            .attr("x", (d) => xScale(-d.tvShows))
            .attr("width", (d) => xScale(0) - xScale(-d.tvShows)),
        (exit) =>
          exit.transition(t).attr("x", xScale(0)).attr("width", 0).remove()
      )
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(50).style("opacity", 1);
        tooltip.html(
          `<div>${d.platform}</div><div>TV Shows: ${d.tvShows}</div>`
        );
        const bbox = tooltip.node().getBoundingClientRect();
        tooltip
          .style("left", event.pageX - bbox.width / 2 + "px")
          .style("top", event.pageY - bbox.height - 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(50).style("opacity", 0);
      })
      .on("click", function(event, d) {
        currentFilters.selectedPlatforms = [d.platform];
        currentFilters.type = ["SHOW"];
        applyFilters();
      });

    svg
      .selectAll(".movie-bar")
      .data(aggData, (d) => d.platform)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("class", "movie-bar")
            .attr("y", (d) => yScale(d.platform))
            .attr("height", yScale.bandwidth())
            .attr("fill", typeFilterColors.MOVIE)
            .attr("x", xScale(0))
            .attr("width", 0)
            .call((enter) =>
              enter
                .transition(t)
                .attr("width", (d) => xScale(d.movies) - xScale(0))
            ),
        (update) =>
          update
            .transition(t)
            .attr("y", (d) => yScale(d.platform))
            .attr("height", yScale.bandwidth())
            .attr("x", xScale(0))
            .attr("width", (d) => xScale(d.movies) - xScale(0)),
        (exit) => exit.transition(t).attr("width", 0).remove()
      )
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(50).style("opacity", 1);
        tooltip.html(`<div>${d.platform}</div><div>Movies: ${d.movies}</div>`);
        const bbox = tooltip.node().getBoundingClientRect();
        tooltip
          .style("left", event.pageX - bbox.width / 2 + "px")
          .style("top", event.pageY - bbox.height - 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(50).style("opacity", 0);
      })
      .on("click", function(event, d) {
        currentFilters.selectedPlatforms = [d.platform];
        currentFilters.type = ["MOVIE"];
        applyFilters();
      });
  }
}

const handleClick = function (event, d) {
  const name = d.name;

  // Check if the name exists in the genre list
  if (d3.selectAll('#genre-filter-list input').nodes().some((n) => n.parentNode.textContent.trim() === name)) {
    currentFilters.selectedGenres = [name];
  }
  // Check if the name exists in platform buttons
  else if (d3.selectAll('.platform-buttons button').nodes().some((n) => n.getAttribute('data-platform') === name)) {
    currentFilters.selectedPlatforms = [name];
  }
  // Check if the name exists in audience buttons
  else if (d3.selectAll('.audience-buttons button').nodes().some((n) => n.getAttribute('audience-buttons') === name)) {
    currentFilters.selectedAudiences = [name];
  }
  // Check if it’s a country (optional)
  else if (d3.selectAll('.country-list-item').nodes().some((n) => n.textContent.trim() === name)) {
    currentFilters.selectedCountries = [name];
  }

  // Re-apply filters and re-render
  applyFilters();
};

function renderSankeyChart(data, toReload) {
  const container = d3.select("#sankey-chart");
  const bounds = container.node().getBoundingClientRect();
  if (bounds.width < 10 || bounds.height < 10) return;

  const margin = { top: 40, right: 10, bottom: 10, left: 10 };
  const width = bounds.width - margin.left - margin.right;
  const height = bounds.height - margin.top - margin.bottom;

  let svg = container.select("svg");
  if (svg.empty()) {
    svg = container.append("svg");
    svg.append("g").attr("class", "links-group");
    svg.append("g").attr("class", "nodes-group");
    svg.append("g").attr("class", "labels-group");
    svg.append("text").attr("class", "chart-title");
  }

  svg
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);
  const g = svg
    .select("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const validData = data.filter(
    (d) =>
      isValidString(d.streaming_platform) &&
      isValidString(d.main_genre) &&
      d.main_genre !== "Unknown" &&
      isValidString(d.age_category)
  );

  const noDataMessage = svg
    .selectAll(".no-data-message")
    .data(validData.length === 0 ? [1] : []);
  noDataMessage
    .enter()
    .append("text")
    .attr("class", "no-data-message")
    .attr("x", bounds.width / 2)
    .attr("y", bounds.height / 2)
    .attr("text-anchor", "middle")
    .text("No data available for the current filter selection.")
    .style("fill", "var(--muted-text)");
  noDataMessage.exit().remove();

  svg
    .selectAll(".links-group, .nodes-group, .labels-group")
    .style("display", validData.length === 0 ? "none" : null);
  if (validData.length === 0) return;

  const nodes = new Set();
  const links = [];
  const platformGenreLinks = {};
  const genreAgeLinks = {};
  validData.forEach((d) => {
    nodes.add(d.streaming_platform);
    nodes.add(d.main_genre);
    nodes.add(d.age_category);
    const pgKey = `${d.streaming_platform}|${d.main_genre}`;
    platformGenreLinks[pgKey] = (platformGenreLinks[pgKey] || 0) + 1;
    const gaKey = `${d.main_genre}|${d.age_category}`;
    genreAgeLinks[gaKey] = (genreAgeLinks[gaKey] || 0) + 1;
  });
  for (const key in platformGenreLinks) {
    const [source, target] = key.split("|");
    links.push({ source, target, value: platformGenreLinks[key] });
  }
  for (const key in genreAgeLinks) {
    const [source, target] = key.split("|");
    links.push({ source, target, value: genreAgeLinks[key] });
  }

  const sankey = d3
    .sankey()
    .nodeId((d) => d.name)
    .nodeWidth(15)
    .nodePadding(10)
    .extent([
      [1, 1],
      [width - 1, height - 6],
    ]);
  const { nodes: graphNodes, links: graphLinks } = sankey({
    nodes: Array.from(nodes).map((name) => ({ name })),
    links: links.map((d) => ({ ...d })),
  });

  const genreSet = new Set(validData.map((d) => d.main_genre));
  const genreColorScale = d3
    .scaleOrdinal(d3.schemeCategory10)
    .domain(Array.from(genreSet));
  const color = (d) => {
    if (platformColors[d.name]) return platformColors[d.name];
    if (genreSet.has(d.name)) return genreColorScale(d.name);
    return "#8bbb8bc5";
  };

  const handleMouseOut = function () {
    d3.select(this).transition().duration(50).attr("opacity", 0.65);
    tooltip.transition().duration(50).style("opacity", 0);
  };

  
 const handleClick = function (event, d) {
    const name = d.name;

    // Check if the name exists in the genre list
    if (d3.selectAll('#genre-filter-list input').nodes().some((n) => n.parentNode.textContent.trim() === name)) {
      currentFilters.selectedGenres = [name];
      d3.select("#select-all-genres").text("Select All");
    }
    // Check if the name exists in platform buttons
    else if (d3.selectAll('.platform-buttons button').nodes().some((n) => n.getAttribute('data-platform') === name)) {
      currentFilters.selectedPlatforms = [name];
    }
    // Check if the name exists in audience buttons
    else if (d3.selectAll('.audience-buttons button').nodes().some((n) => n.getAttribute('audience-buttons') === name)) {
      currentFilters.selectedAudiences = [name];
    }
    // Check if it’s a country (optional)
    else if (d3.selectAll('.country-list-item').nodes().some((n) => n.textContent.trim() === name)) {
      currentFilters.selectedCountries = [name];
    }

    // Re-apply filters and re-render
    applyFilters();
  };


  const handleLinkMouseOver = function (event, d) {
    d3.select(this).transition().duration(50).attr("opacity", 1);
    tooltip.transition().duration(50).style("opacity", 1);
    tooltip
      .html(
        `Source: ${d.source.name}<br/>Target: ${d.target.name}<br/>Quantity: ${d.value}`
      )
      .style("left", event.pageX + 15 + "px")
      .style("top", event.pageY - 28 + "px");
  };

  const handleNodeMouseOver = function (event, d) {
    d3.select(this).transition().duration(50).attr("opacity", 1);
    tooltip.transition().duration(50).style("opacity", 1);
    tooltip
      .html(`Total quantity: ${d.value}`)
      .style("left", event.pageX + 15 + "px")
      .style("top", event.pageY - 28 + "px");
  };

  const t = svg.transition().duration(750);

  svg
    .select(".links-group")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .selectAll(".sankey-link")
    .data(graphLinks, (d) => `${d.source.name}-${d.target.name}`)
    .join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "sankey-link")
          .attr("d", d3.sankeyLinkHorizontal())
          .attr("stroke", (d) => color(d.source))
          .attr("stroke-width", 0)
          .attr("opacity", 0.65)
          .on("mouseover", handleLinkMouseOver)
          .on("mouseout", handleMouseOut)
          .call((enter) =>
            enter
              .transition(t)
              .attr("stroke-width", (d) => Math.max(1, d.width))
          ),
      (update) =>
        update
          .on("mouseover", handleLinkMouseOver)
          .on("mouseout", handleMouseOut)
          .call((update) =>
            update
              .transition(t)
              .attr("stroke", (d) => color(d.source))
              .attr("d", d3.sankeyLinkHorizontal())
              .attr("stroke-width", (d) => Math.max(1, d.width))
          ),
      (exit) =>
        exit.call((exit) => exit.transition(t).attr("stroke-width", 0).remove())
    );

  svg
    .select(".nodes-group")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .selectAll(".sankey-node")
    .data(graphNodes, (d) => d.name)
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("class", "sankey-node")
          .attr("x", (d) => d.x0)
          .attr("y", (d) => d.y0)
          .attr("width", (d) => d.x1 - d.x0)
          .attr("fill", (d) => color(d))
          .attr("opacity", 0.65)
          .on("mouseover", handleNodeMouseOver)
          .on("mouseout", handleMouseOut)
          .attr("height", 0)
          .call((enter) =>
            enter.transition(t).attr("height", (d) => d.y1 - d.y0)
          ),
      (update) =>
        update
          .on("mouseover", handleNodeMouseOver)
          .on("mouseout", handleMouseOut)
          .on("click", handleClick)
          .call((update) =>
            update
              .transition(t)
              .attr("fill", (d) => color(d)) // transition
              .attr("x", (d) => d.x0)
              .attr("y", (d) => d.y0)
              .attr("height", (d) => d.y1 - d.y0)
          ),
      (exit) =>
        exit.call((exit) => exit.transition(t).attr("height", 0).remove())
    );

  const audienceLabels = {
    adult: "Adult",
    child: "Children",
    teenager: "Teenager",
    toddlers: "Toddler",
  };

  svg
    .select(".labels-group")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .selectAll(".sankey-node-label")
    .data(graphNodes, (d) => d.name)
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "sankey-node-label")
          .attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
          .attr("y", (d) => (d.y1 + d.y0) / 2)
          .attr("dy", "0.35em")
          .attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
          .text((d) => audienceLabels[d.name] || d.name)
          .attr("opacity", 0)
          .call((enter) => enter.transition(t).attr("opacity", 1)),
      (update) =>
        update.call((update) =>
          update
            .transition(t)
            .attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
            .attr("y", (d) => (d.y1 + d.y0) / 2)
            .attr("opacity", 1)
        ),
      (exit) =>
        exit.call((exit) => exit.transition(t).attr("opacity", 0).remove())
    );

  svg
    .select(".chart-title")
    .attr("x", width / 2 + margin.left)
    .attr("y", margin.top - 15)
    .attr("text-anchor", "middle")
    .style("font-size", "1rem")
    .style("font-weight", "600")
    .style("fill", "#334155")
    .text("Content Flow: Platform → Genre → Target Audience");
}


function renderTreemapChart(data) {
    const container = d3.select("#treemap-chart");

    const bounds = container.node().getBoundingClientRect();
    if (bounds.width < 10 || bounds.height < 10) return;

    const margin = { top: 40, right: 10, bottom: 10, left: 10 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;
    
    //container.selectAll("svg").remove();
    const svg = container.selectAll("svg").data([null]).join(
      enter => enter
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`),
      update => update.select("g")
    );
    
    
    const countryCounts = new Map();
    data.forEach(d => {
        d.countries.forEach(country => {
            // Only count a country if it's part of the current filter selection.
            if (country && countryToContinent[country] && currentFilters.selectedCountries.includes(country)) {
                countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
            }
        });
    });

   
    const selectedContinents = new Set(
        currentFilters.selectedCountries
            .map(country => countryToContinent[country])
            .filter(continent => continent) // Filter out undefined/null
    );
    if (treemapCurrentView !== 'Continents' && treemapCurrentView !== 'Countries') {
        if (selectedContinents.size > 1 || !selectedContinents.has(treemapCurrentView)) {
            treemapCurrentView = 'Continents';
        }
    }
    let currentViewData;
    const allCountryNames = d3.selectAll("#country-filter-list .list-item-container").data();
    // This logic to decide the view is already correct.
    if (currentLocationView === 'Countries') {
        const children = Array.from(countryCounts.entries()).map(([name, value]) => ({ name, value }));
        const isFullSelection = currentFilters.selectedCountries.length > 0 && currentFilters.selectedCountries.length === allCountryNames.length;
        const title = isFullSelection ? "All Countries" : "Selected Countries";
        currentViewData = { name: title, children };
        //backButton.style("display", "none");
        treemapCurrentView = 'Continents';
        d3.select("#country-continent-search")
        .property("placeholder", "Search countries...");
    } else { 
        if (treemapCurrentView === 'Continents') {
            const continentChildren = Array.from(d3.group(
                Array.from(countryCounts.keys()), d => countryToContinent[d]
            ), ([continent, countries]) => ({
                name: continent,
                value: d3.sum(countries, c => countryCounts.get(c))
            }));
            currentViewData = { name: "Continents", children: continentChildren };
            d3.select("#country-continent-search")
        .property("placeholder", "Search continents...");
            //backButton.style("display", "none");
        } else {
            const children = Array.from(countryCounts)
                .filter(([country]) => countryToContinent[country] === treemapCurrentView)
                .map(([name, value]) => ({ name, value }));
            if (children.length === 0) {
                treemapCurrentView = 'Countries';
                renderTreemapChart(data); // Re-render if drill-down is empty
                return;
            }
            currentViewData = { name: treemapCurrentView, children };
        }
    }

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    function draw(viewData) {
        const root = d3.hierarchy(viewData).sum(d => d.value);
        d3.treemap().size([width, height]).padding(2)(root);
        svg.selectAll(".chart-title").data([viewData.name]).join("text")
            .attr("class", "chart-title")
            .attr("x", width / 2).attr("y", -15).attr("text-anchor", "middle")
            .style("font-size", "1rem").style("font-weight", "600").style("fill", "#334155")
            .text(`Content Quantity by ${viewData.name}`);
        const t = svg.transition().duration(750);
        const cell = svg.selectAll("g.cell").data(root.leaves(), d => d.data.name);

        cell.exit().selectAll("rect, text").transition(t).style("opacity", 0);
        cell.exit().transition(t).remove();
        
        const cellEnter = cell.enter().append("g").attr("class", "cell");
        
        cellEnter.append("rect")
          .attr("fill", d => {
            // If viewing all continents or all/selected countries — color by name
            if (
              d.parent.data.name === "Continents" ||
              d.parent.data.name === "All Countries" ||
              d.parent.data.name === "Selected Countries"
            ) {
              return colorScale(d.data.name);
            }
            // If viewing countries within a single continent — color each country uniquely
            if (treemapCurrentView && d.parent.data.name === treemapCurrentView) {
              return colorScale(d.data.name); // Different color per country
            }
            // Fallback
            return colorScale(d.parent.data.name);
          })
          .style("stroke", "#fff");

        cellEnter.append("text").attr("class", "treemap-label")
            .selectAll("tspan").data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g)).join("tspan")
            .attr("x", 4).attr("y", (d, i) => 13 + i * 10).text(d => d)
            .attr("font-size", "0.7em").attr("fill", "white").style("pointer-events", "none");

        const allCells = cell.merge(cellEnter);
        allCells.transition(t).attr("transform", d => `translate(${d.x0}, ${d.y0})`);
        
        allCells.select("rect").transition(t)
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0);
        
        allCells.select("text").transition(t)
            .style("opacity", d => (d.x1 - d.x0 > 35 && d.y1 - d.y0 > 20 ? 1 : 0));
        
        allCells.on("click", (event, d) => {
            if (d.parent.data.name === "Continents") {
                // 1. Treemap Drill-down: Set the view for the treemap to render countries
                treemapCurrentView = d.data.name;

                // 2. Filter Panel Update: Get all countries in this continent
                const continentName = d.data.name;
                const countriesInContinent = Object.keys(countryToContinent).filter(
                    (country) => countryToContinent[country] === continentName
                );
                

                // 3. Update Global Filter State
                currentFilters.selectedCountries = countriesInContinent;
                
                // 4. Update Filter Panel View (optional, but good practice for consistency)
                currentLocationView = 'Continents'; // Keep the filter panel on the continent view initially
                d3.select("#country-continent-search")
                  .property("placeholder", "Search continents...");

                // 5. Apply filters to re-render all visualizations
                applyFilters(); 
            } else {
                // For filtering, update the selection and apply filters
                currentFilters.selectedCountries = [d.data.name];
                d3.select("#country-view-container").style("display", "block");
                d3.select("#continent-view-container").style("display", "none");
                d3.select("#view-countries-btn").classed("active", true);
                d3.select("#view-continents-btn").classed("active", false);
                currentLocationView = 'Countries';
                d3.select("#country-continent-search")
                  .property("placeholder", "Search countries...");
                applyFilters();
            }
        });

        allCells.select('rect')
            .on("mouseover", function(event, d) {
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`<div><b>${d.data.name}</b></div><div><b>Titles:</b> ${d.value.toLocaleString()}</div>`);
                const bbox = tooltip.node().getBoundingClientRect();
                tooltip.style("left", `${event.pageX - bbox.width / 2}px`).style("top", `${event.pageY - bbox.height - 10}px`);
            })
            .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
    }

    if (!currentViewData.children || currentViewData.children.length === 0) {

        svg.selectAll("g.cell, .chart-title, .no-data-message").remove(); 
        
        svg.append("text").attr("class", "no-data-message")
            .attr("x", width / 2).attr("y", height / 2)
            .attr("text-anchor", "middle")
            .text("No country data for this selection.")
            .style("fill", "var(--muted-text)");
        return;
    }

    draw(currentViewData);
}

document.addEventListener('click', function(event) {
    const filtersPanel = document.getElementById('filters-panel');
    const toggleButton = document.getElementById('toggle-filters-btn');

    const isFiltersVisible = filtersPanel && window.getComputedStyle(filtersPanel).display !== 'none';

    if (isFiltersVisible) {
        const clickedInsideFilters = event.target.closest('#filters-panel');
        const clickedToggleButton = event.target.closest('#toggle-filters-btn');
        const clickedTreemap = event.target.closest('#treemap-chart');
        const clickedSankey = event.target.closest('#sankey-chart');
        const clickedTime = event.target.closest('#timeline-filter');
        const clickedQuantity = event.target.closest('#quantity-chart');

        
        if (!clickedInsideFilters && !clickedToggleButton && !clickedTreemap && !clickedSankey && !clickedTime && !clickedQuantity) {
            
            if (typeof toggleFilters === 'function') {
                 toggleFilters(); 
            } else {
                filtersPanel.style.display = "none";
                if (toggleButton) {
                    toggleButton.classList.remove('active');
                }
            }
        }
    }
});

function removeChartFilters(chartId) {
  
    // --- Logic for Treemap Chart (Assumed to filter by Geographic Location) ---
    // The treemap is typically tied to the 'Continent/Country' filter.
    if (chartId === 'treemap-chart') {
      treemapCurrentView = 'Continents';
      currentLocationView = 'Continents';
      d3.select("#country-continent-search")
        .property("placeholder", "Search continents..."); 
      const allCountryNames = d3.selectAll("#country-filter-list .list-item-container").data().map(d => d);
      currentFilters.selectedCountries = [...allCountryNames];
      d3.select("#continent-view-container").style("display", "block");
      d3.select("#country-view-container").style("display", "none");
      d3.select("#view-continents-btn").classed("active", true);
      d3.select("#view-countries-btn").classed("active", false);
      d3.selectAll(".country-list-item").style("display", "block");
      applyFilters();
    }

    
    if (chartId === 'quantity-chart') {
      currentFilters.selectedPlatforms = [];
      currentFilters.type = [];
      d3.selectAll(
      ".content-type-filter button, .platform-buttons button"
      )
      .classed("active", false)
      .classed("inactive", false);
      applyFilters();
    }

    if (chartId === 'sankey-chart') {
      currentFilters.selectedGenres = [];
      currentFilters.selectedAudiences = [];
      currentFilters.selectedPlatforms = [];
      d3.selectAll(
      ".content-type-filter button, .platform-buttons button, .audience-buttons button"
      )
        .classed("active", false)
        .classed("inactive", false);
      // d3.selectAll('#genre-filter-list input[type="checkbox"]').property(
      //   "checked",
      //   true
      // );
      const allGenres = [];
      d3.selectAll('#genre-filter-list input[type="checkbox"]').each(function () {
        allGenres.push(d3.select(this.parentNode).text().trim());
      });
      currentFilters.selectedGenres = allGenres;
      applyFilters();
    }
    if (chartId === 'timeline-filter'){
      yearSlider.reset();
      applyFilters();
    }
    
}

document.addEventListener('DOMContentLoaded', () => {
    // Select the main chart containers
    const treemapChart = document.getElementById('treemap-chart');
    const quantityChart = document.getElementById('quantity-chart');
    const sankeyChart = document.getElementById('sankey-chart');
    const timeLine = document.getElementById('timeline-filter')

    if (treemapChart) {
        treemapChart.addEventListener('dblclick', (event) => {
            // Prevent the double-click from propagating up and doing other things
            event.stopPropagation(); 
            removeChartFilters('treemap-chart');
        });
    }

    if (quantityChart) {
        quantityChart.addEventListener('dblclick', (event) => {
            event.stopPropagation();
            removeChartFilters('quantity-chart');
        });
    }

    if (sankeyChart) {
        sankeyChart.addEventListener('dblclick', (event) => {
            event.stopPropagation();
            removeChartFilters('sankey-chart');
        });
    }
    if (timeLine) {
        timeLine.addEventListener('dblclick', (event) => {
            event.stopPropagation();
            removeChartFilters('timeline-filter');
        });
    }

});

function handleCountryContinentSearch() {
    // Get the search term and convert it to lower case for case-insensitive matching
    const searchTerm = d3.select("#country-continent-search").property("value").toLowerCase();
    
    // --- 1. Filter Country View ---
    d3.select("#country-filter-list").selectAll(".list-item-container")
        .each(function(d) {
            // 'd' is the bound country name for country view
            const countryName = d.toLowerCase();
            const matches = countryName.includes(searchTerm);
            
            // Apply the 'filter-hidden' class if it doesn't match
            d3.select(this)
                .classed("filter-hidden", !matches);
        });

    // --- 2. Filter Continent View ---
    d3.select("#continent-filter-list").selectAll(".list-item-container")
        .each(function(d) {
            // 'd' is the bound continent name for continent view
            const continentName = d.toLowerCase();
            const matches = continentName.includes(searchTerm);
            
            // Apply the 'filter-hidden' class if it doesn't match
            d3.select(this)
                .classed("filter-hidden", !matches);
        });
}
function handleGenreSearch() {
    const searchTerm = d3.select("#genre-search").property("value").toLowerCase();
    d3.select("#genre-filter-list").selectAll("#genre-filter-list > *")
        .each(function() {
          
            const container = d3.select(this);
            const listItemText = container.text().trim();
        
            const cleanText = listItemText
                               .replace(/[\u2713\u2714✓]/g, '') // Remove checkmark symbols
                               .replace(/\[\s*\]/g, '')     // Remove blank brackets
                               .replace(/[\s\t\n]+/g, ' ')  // Collapse multiple spaces
                               .trim();

            const matches = cleanText.toLowerCase().includes(searchTerm);
            
            container.classed("filter-hidden", !matches);
        });
}

document.addEventListener('DOMContentLoaded', () => {

    d3.select("#country-continent-search").on("input", handleCountryContinentSearch);
    d3.select("#genre-search").on("input", handleGenreSearch);
});