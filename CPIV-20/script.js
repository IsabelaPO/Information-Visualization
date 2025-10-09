const isValidString = (str) =>
  str && typeof str === "string" && str.trim() !== "";

//stores all platform data
let allPlatformData = [];
let allPriceData = [];
let tooltip; // Tooltip is defined once globally
firstRender = true;

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
  selectedPlatforms: []
};

//apply the initial to the current filters
//where the filters are saved when changed
let currentFilters = { ...defaultFilters };

// Variables to hold our slider instances so we can reset them ---
let imdbSlider, yearSlider;
//loads the csv files with d3
document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    d3.csv("streaming_platforms.csv"),
    d3.csv("streaming_prices.csv"),
  ])
    .then(([rawPlatformData, rawPriceData]) => {
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
        // This is the important change from main_country to countries array
        countries: isValidString(d.production_countries)
          ? d.production_countries.split(',').map(c => c.trim())
          : [],
      }));
      const processedPriceData = rawPriceData.map((d) => ({
        ...d,
        year: +d.year,
        price: +d.price,
      }));

      //stores the processed data
      allPlatformData = processedPlatformData;
      allPriceData = processedPriceData;
      
      // --- Create the tooltip div once and for all. ---
      tooltip = d3.select("body").selectAll(".tooltip-donut")
        .data([0])
        .join("div")
        .attr("class", "tooltip-donut")
        .style("position", "absolute")
        .style("opacity", 0);

      document.getElementById("loading").style.display = "none";
      // document.getElementById("dashboard-main").style.visibility = "visible";

      //initializes al filters and sliders
      setupPlatformFilter();
      setupContentTypeFilter();
      populateGenreFilter(allPlatformData);
      setupGenreFilter();
      imdbSlider = setupImdbSlider(); // Store the returned slider object
      yearSlider = setupYearSlider(allPlatformData); // Store the returned slider object
      setupAudienceFilter();
      setupRemoveFiltersButton();

      //draws initial visualizations
      renderAllVisualizations(allPlatformData, allPriceData);

      window.addEventListener("resize", () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(
          () => renderAllVisualizations(allPlatformData, allPriceData),
          250
        );
      });
      //Re-renders chart on window resize (with debounce)
    })
    .catch((error) => console.error("Data loading failed:", error));
});

function renderAllVisualizations(data, price) {
  renderSankeyChart(data);
  renderQuantityChart(data);
}

function applyFilters() {
  let filteredPlatformData = allPlatformData;
  let filteredPriceData = allPriceData;

  if (currentFilters.selectedPlatforms.length > 0) {
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.selectedPlatforms.includes(d.streaming_platform)
    );
  }

  if (currentFilters.type.length > 0) {
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.type.includes(d.type)
    );
  }

  filteredPlatformData = filteredPlatformData.filter(
    (d) =>
      d.imdb_score >= currentFilters.imdbRange[0] &&
      d.imdb_score <= currentFilters.imdbRange[1]
  );

  if (currentFilters.selectedGenres.length > 0) {
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.selectedGenres.includes(d.main_genre)
    );
  }

  if (currentFilters.yearRange) {
    filteredPlatformData = filteredPlatformData.filter(
      (d) =>
        d.release_year >= currentFilters.yearRange[0] &&
        d.release_year <= currentFilters.yearRange[1]
    );
    filteredPriceData = filteredPriceData.filter(
      (d) =>
        d.year >= currentFilters.yearRange[0] &&
        d.year <= currentFilters.yearRange[1]
    );
  }

  if (currentFilters.selectedAudiences.length > 0) {
    filteredPlatformData = filteredPlatformData.filter((d) =>
      currentFilters.selectedAudiences.includes(d.age_category)
    );
  }

  const platformsSet = new Set(filteredPlatformData.map(d => d.streaming_platform));
  const result = filteredPriceData.filter((d) =>
    platformsSet.has(d.streaming_platform)
  );

  renderAllVisualizations(filteredPlatformData, result);
}function setupRemoveFiltersButton() {
  d3.select(".remove-filters-btn").on("click", () => {
    // 1. Reset the state object
    currentFilters = { ...defaultFilters };

    // 2. Reset the other UI controls
    d3.selectAll(".content-type-filter button, .platform-buttons button, .audience-buttons button")
      .classed("active", false)
      .classed("inactive", false);
    d3.selectAll('#genre-filter-list input[type="checkbox"]').property("checked", false);

    // Reset the sliders
    if (imdbSlider) imdbSlider.reset();
    if (yearSlider) yearSlider.reset();

    // 3. Apply filters
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
    .on("end", (event) => {
      // When user stops dragging, convert pixel coords back into data values
      let valueRange = event.selection
        ? event.selection.map(xScale.invert)
        : config.domain;
      config.onBrushEnd(valueRange);
    });

  const gBrush = svg.append("g").attr("class", "brush").call(brush);
  gBrush.call(brush.move, config.domain.map(xScale));

  // Update the min/max labels outside the slider with formatted values
  d3.select(config.minLabelId).text(config.tickFormat(config.domain[0]));
  d3.select(config.maxLabelId).text(config.tickFormat(config.domain[1]));

  // Return an object with a reset method
  return {
    reset: () => {
      gBrush.call(brush.move, config.domain.map(xScale));
      d3.select(config.minLabelId).text(config.tickFormat(config.domain[0]));
      d3.select(config.maxLabelId).text(config.tickFormat(config.domain[1]));
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
  d3.selectAll('#genre-filter-list input[type="checkbox"]').on("change", () => {
    const selected = [];
    d3.selectAll('#genre-filter-list input[type="checkbox"]:checked').each(
      function () {
        selected.push(d3.select(this.parentNode).text().trim());
      }
    );
    currentFilters.selectedGenres = selected;
    applyFilters();
  });
}

function populateGenreFilter(data) {
  const genres = new Set(
    data.flatMap((d) =>
      isValidString(d.genres) ? d.genres.split(",").map((g) => g.trim()) : []
    )
  );

  d3.select("#genre-filter-list")
    .selectAll("div")
    .data(Array.from(genres).sort())
    .enter()
    .append("div")
    .html(
      (d) =>
        `<label style="display: flex; align-items: center; cursor: pointer; font-weight: normal;"><input type="checkbox" style="margin-right: 0.5rem;">${d}</label>`
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
  const svg = container.selectAll("svg")
    .data([null])
    .join("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .selectAll("g") // Select g, or create it if it doesn't exist
    .data([null])
    .join("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  // Check if a single content type is selected
  const singleTypeSelected = currentFilters.type.length === 1 ? currentFilters.type[0] : null;

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
  aggData.sort((a, b) => (b.movies + b.tvShows) - (a.movies + a.tvShows));
  
  const noDataMessage = svg.selectAll(".no-data-message").data(aggData.length === 0 ? [1] : []);
  noDataMessage.enter().append("text").attr("class", "no-data-message")
    .attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle")
    .text("No data available for the current filter selection.").style("fill", "var(--muted-text)");
  noDataMessage.exit().transition(t).style("opacity", 0).remove();
  
  if (aggData.length === 0) {
    svg.selectAll(".tv-show-bar, .movie-bar, .bar, .center-line").transition(t).attr("width", 0).attr("height", 0).remove();
    return;
  }

  if (singleTypeSelected) {
    // --- A. ANIMATE TO NORMAL BAR CHART ---
    const dataType = singleTypeSelected === 'SHOW' ? 'tvShows' : 'movies';
    
    svg.selectAll(".chart-title").data([singleTypeSelected === 'SHOW' ? "TV Show Quantities" : "Movie Quantities"]).join("text")
        .attr("class", "chart-title").attr("x", width / 2).attr("y", -15).attr("text-anchor", "middle")
        .style("font-size", "1rem").style("font-weight", "600").style("fill", "#334155").text(d => d);

    const xScale = d3.scaleBand().domain(aggData.map(d => d.platform)).range([0, width]).padding(0.2);
    const yScale = d3.scaleLinear().domain([0, d3.max(aggData, d => d[dataType]) * 1.1]).range([height, 0]);

    svg.selectAll(".x-axis").data([null]).join("g").attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${height})`).transition(t).call(d3.axisBottom(xScale));
    svg.selectAll(".y-axis").data([null]).join("g").attr("class", "axis y-axis")
        .transition(t).call(d3.axisLeft(yScale).ticks(5));

    svg.selectAll(".tv-show-bar, .movie-bar, .center-line").transition(t).attr("width", 0).style("opacity", 0).remove();
    
    svg.selectAll(".bar")
      .data(aggData, d => d.platform)
      .join(
        enter => enter.append("rect")
          .attr("class", "bar")
          .attr("fill", typeFilterColors[singleTypeSelected])
          .attr("x", d => xScale(d.platform))
          .attr("y", height)
          .attr("width", xScale.bandwidth())
          .attr("height", 0)
          .call(enter => enter.transition(t)
            .attr("y", d => yScale(d[dataType]))
            .attr("height", d => height - yScale(d[dataType]))),
        update => update
          .call(update => update.transition(t)
            .attr("x", d => xScale(d.platform))
            .attr("width", xScale.bandwidth())
            .attr("y", d => yScale(d[dataType]))
            .attr("height", d => height - yScale(d[dataType]))),
        exit => exit.transition(t)
          .attr("y", height)
          .attr("height", 0)
          .remove()
      )
      .on("mouseover", function (event, d) {
          tooltip.transition().duration(50).style("opacity", 1);
          tooltip.html(`<div>${d.platform}</div><div>${singleTypeSelected}: ${d[dataType]}</div>`);
          const bbox = tooltip.node().getBoundingClientRect();
          tooltip.style("left", (event.pageX - bbox.width / 2) + "px")
               .style("top", (event.pageY - bbox.height - 10) + "px");
      })
      .on("mouseout", function () {
          tooltip.transition().duration(50).style("opacity", 0);
      });

  } else {
    // --- B. ANIMATE TO BUTTERFLY CHART ---
    svg.selectAll(".chart-title").data(["TV Shows vs. Movies"]).join("text")
        .attr("class", "chart-title").attr("x", width / 2).attr("y", -15).attr("text-anchor", "middle")
        .style("font-size", "1rem").style("font-weight", "600").style("fill", "#334155").text(d => d);

    const maxVal = d3.max(aggData, (d) => Math.max(d.tvShows, d.movies)) * 1.1;
    const xScale = d3.scaleLinear().domain([-maxVal, maxVal]).range([0, width]);
    const yScale = d3.scaleBand().domain(aggData.map((d) => d.platform)).range([0, height]).padding(0.4);

    svg.selectAll(".x-axis").data([null]).join("g").attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${height})`).transition(t).call(d3.axisBottom(xScale).ticks(7).tickFormat(Math.abs));
    svg.selectAll(".y-axis").data([null]).join("g").attr("class", "axis y-axis")
        .transition(t).call(d3.axisLeft(yScale));
    
    svg.selectAll(".bar").transition(t).attr("height", 0).attr("y", height).remove();
    
    svg.selectAll(".center-line").data([null]).join("line").attr("class", "center-line")
        .attr("y1", 0).attr("y2", height).attr("stroke", "#B0B0B0").attr("stroke-width", 1)
        .style("opacity", 0) // Start transparent
        .transition(t).style("opacity", 1).attr("x1", xScale(0)).attr("x2", xScale(0));

    svg.selectAll(".tv-show-bar").data(aggData, d => d.platform)
      .join(
        enter => enter.append("rect")
          .attr("class", "tv-show-bar").attr("y", d => yScale(d.platform)).attr("height", yScale.bandwidth())
          .attr("fill", typeFilterColors.SHOW).attr("x", xScale(0)).attr("width", 0)
          .call(enter => enter.transition(t).attr("x", d => xScale(-d.tvShows)).attr("width", d => xScale(0) - xScale(-d.tvShows))),
        update => update.transition(t)
          .attr("y", d => yScale(d.platform)).attr("height", yScale.bandwidth())
          .attr("x", d => xScale(-d.tvShows)).attr("width", d => xScale(0) - xScale(-d.tvShows)),
        exit => exit.transition(t).attr("x", xScale(0)).attr("width", 0).remove()
      )
      .on("mouseover", function (event, d) {
          tooltip.transition().duration(50).style("opacity", 1);
          tooltip.html(`<div>${d.platform}</div><div>TV Shows: ${d.tvShows}</div>`);
          const bbox = tooltip.node().getBoundingClientRect();
          tooltip.style("left", (event.pageX - bbox.width / 2) + "px")
               .style("top", (event.pageY - bbox.height - 10) + "px");
      })
      .on("mouseout", function () {
          tooltip.transition().duration(50).style("opacity", 0);
      });

    svg.selectAll(".movie-bar").data(aggData, d => d.platform)
      .join(
        enter => enter.append("rect")
          .attr("class", "movie-bar").attr("y", d => yScale(d.platform)).attr("height", yScale.bandwidth())
          .attr("fill", typeFilterColors.MOVIE).attr("x", xScale(0)).attr("width", 0)
          .call(enter => enter.transition(t).attr("width", d => xScale(d.movies) - xScale(0))),
        update => update.transition(t)
          .attr("y", d => yScale(d.platform)).attr("height", yScale.bandwidth())
          .attr("x", xScale(0)).attr("width", d => xScale(d.movies) - xScale(0)),
        exit => exit.transition(t).attr("width", 0).remove()
      )
      .on("mouseover", function (event, d) {
          tooltip.transition().duration(50).style("opacity", 1);
          tooltip.html(`<div>${d.platform}</div><div>Movies: ${d.movies}</div>`);
          const bbox = tooltip.node().getBoundingClientRect();
          tooltip.style("left", (event.pageX - bbox.width / 2) + "px")
               .style("top", (event.pageY - bbox.height - 10) + "px");
      })
      .on("mouseout", function () {
          tooltip.transition().duration(50).style("opacity", 0);
      });
  }
}

function renderSankeyChart(data) {
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
  const genreColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(Array.from(genreSet));
  const color = (d) => {
    if (platformColors[d.name]) return platformColors[d.name];
    if (genreSet.has(d.name)) return genreColorScale(d.name);
    return "#8bbb8bc5";
  };

  const handleMouseOut = function () {
    d3.select(this).transition().duration(50).attr("opacity", 0.65);
    tooltip.transition().duration(50).style("opacity", 0);
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