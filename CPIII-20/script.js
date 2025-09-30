
//checks if string exists and not just whitespace
const isValidString = (str) => str && typeof str === 'string' && str.trim() !== '';

//stores all platform data
let allPlatformData = [];

//sets platform colors
const platformColors = {
    "Netflix": "#E50914", 
    "Amazon": "#FF9900", 
    "Disney": "#113CCF",
    "HBO": "#9068F4", 
    "Paramount": "#0090FF", 
    "Apple": "#A2AAAD"
};

// A constant to hold the default filter state for easy resetting ---
//how filters look in the dashboard initially 
const defaultFilters = {
    type: 'TV Shows & Movies',
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
document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
      d3.csv("streaming_platforms.csv"),
      d3.csv("streaming_prices.csv")
  ]).then(([rawPlatformData, rawPriceData]) => {
  const processedPlatformData = rawPlatformData.map(d => ({
    ...d,
    streaming_platform: d.streaming_platform,
    release_year: +d.release_year, //convert into number
    imdb_score: +d.imdb_score, //convert into number
    type: d.type,
    genres: d.genres || '', //ensures not empty 
    age_category: d.age_category || 'Unknown', //ensures not empty
    //extracts first genre to main genre because there are many genres in one movie
    main_genre: isValidString(d.genres) ? d.genres.split(',')[0].trim() : 'Unknown' 
   // main_country: isValidString(d.production_countries) ? d.production_countries.split(',')[0].trim() : 'Unknown'
  }));
  //stores the processed data
  allPlatformData = processedPlatformData;

  document.getElementById('loading').style.display = 'none';
  document.querySelector('main').style.visibility = 'visible';
  
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
  renderAllVisualizations(allPlatformData);

  window.addEventListener('resize', () => { clearTimeout(window.resizeTimer); window.resizeTimer = setTimeout(() => renderAllVisualizations(allPlatformData), 250); });
  //Re-renders chart on window resize (with debounce)

  }).catch(error => console.error("Data loading failed:", error));
});

function renderAllVisualizations(data) {
  renderSankeyChart(data);
}

function applyFilters() {
  let filteredData = allPlatformData;
  //filter platform
  if (currentFilters.selectedPlatforms.length > 0) {
      filteredData = filteredData.filter(d => currentFilters.selectedPlatforms.includes(d.streaming_platform));
  }
  //filter content type
  if (currentFilters.type === 'TV Shows') filteredData = filteredData.filter(d => d.type === 'SHOW');
  if (currentFilters.type === 'Movies') filteredData = filteredData.filter(d => d.type === 'MOVIE');
  
  //filter imdb range
  filteredData = filteredData.filter(d => d.imdb_score >= currentFilters.imdbRange[0] && d.imdb_score <= currentFilters.imdbRange[1]);

  //filter by genre
  if (currentFilters.selectedGenres.length > 0) {
      filteredData = filteredData.filter(d => currentFilters.selectedGenres.includes(d.main_genre));
  }

  //filter by year
  if (currentFilters.yearRange) {
      filteredData = filteredData.filter(d => d.release_year >= currentFilters.yearRange[0] && d.release_year <= currentFilters.yearRange[1]);
  }

  //filter target audience 
  if (currentFilters.selectedAudiences.length > 0) {
      filteredData = filteredData.filter(d => currentFilters.selectedAudiences.includes(d.age_category));
  }

  //re-render charts
  renderAllVisualizations(filteredData);
}

// --- NEW: Function to set up the 'Remove All Filters' button ---
function setupRemoveFiltersButton() {
  d3.select('.remove-filters-btn').on('click', () => {
    // 1. Reset the state object
    currentFilters = { ...defaultFilters };

    // 2. Reset the UI controls
    d3.select('#content-type-filter').property('value', defaultFilters.type);
    d3.selectAll('.platform-buttons button').classed('active', false);
    d3.selectAll('#genre-filter-list input[type="checkbox"]').property('checked', false);
    d3.selectAll('.audience-buttons button').classed('active', false);
    
    // Reset the sliders using their returned methods
    if (imdbSlider) imdbSlider.reset();
    if (yearSlider) yearSlider.reset();

    // 3. Apply the cleared filters to re-render the chart
    applyFilters();
  });
}

function setupPlatformFilter() {
    //assigns colors to the platform buttons 
    d3.selectAll('.platform-buttons button').each(function() {
        const platform = d3.select(this).attr('data-platform');
        if (platformColors[platform]) {
            d3.select(this).style('background-color', platformColors[platform]);
        }
    });
    //when a button is clicked, it toggles to active class (for css)
    d3.selectAll('.platform-buttons button').on('click', function() {
        const button = d3.select(this);
        //visually marks the button as selected/unselected
        button.classed('active', !button.classed('active'));
        //iterates through active buttons, collects values into selected array
        //saves the array into currentFilters
        const selected = [];
        d3.selectAll('.platform-buttons button.active').each(function() {
            selected.push(d3.select(this).attr('data-platform'));
        });
        //example: Netflix and Disney 
        //currentFilters.selectedPlatforms = ["Netflix", "Disney"]
        currentFilters.selectedPlatforms = selected;
        const anyFilterActive = selected.length > 0;
        d3.selectAll('.platform-buttons button').each(function() {
            const btn = d3.select(this);
            const platform = btn.attr('data-platform');
            //if one platform is active keep those selected as "active" and
            //mark all non-selected buttons as "inactive"
            if (anyFilterActive) {
                const isActive = selected.includes(platform);
                btn.classed('active', isActive);
                btn.classed('inactive', !isActive);
            } else {
              //If no platform is selected clear both "active" and "inactive" classes
                btn.classed('active', false);
                btn.classed('inactive', false);
            }
        });
        applyFilters();
    });
}

function setupAudienceFilter() {
  const audienceMap = {
    'Toddler': 'toddlers', 'Children': 'child',
    'Teen': 'teenager', 'Adult': 'adult'
  };
  d3.selectAll('.audience-buttons button').on('click', function() {
    const button = d3.select(this);
    //visually marks the button as selected/unselected
    button.classed('active', !button.classed('active'));
    // Collect all currently active audience buttons
    const selected = [];
    d3.selectAll('.audience-buttons button.active').each(function() {
        const buttonText = d3.select(this).text();
        const dataValue = audienceMap[buttonText];
        if (dataValue) selected.push(dataValue);
    });
    // Update the global filter state with selected audiences
    currentFilters.selectedAudiences = selected;
    applyFilters();
  });
}

// --- MODIFIED: The slider creator now returns a reset function ---
function createD3RangeSlider(config) {
  //select container and clear previous content 
  const container = d3.select(config.containerId);
  container.selectAll("*").remove();
  // Define margins and calculate inner width/height for the slider area
  const margin = { top: 10, right: 15, bottom: 20, left: 15 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 50 - margin.top - margin.bottom;
  // Create the SVG element and group for the slider
  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Define a linear scale from domain (min/max values) → pixel range
  // clamp(true) ensures values can’t go outside the domain
  const xScale = d3.scaleLinear().domain(config.domain).range([0, width]).clamp(true);

  // Draw the bottom axis with ticks and formatting
  svg.append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0, ${height})`)
  .call(
    d3.axisBottom(xScale)
    .ticks(config.ticks || 5) 
    .tickFormat(config.tickFormat));
  // Create the brush (draggable selection box) across the x-axis
  const brush = d3.brushX()
    .extent([[0, 0], [width, height]])
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
    }
  };
}

function setupYearSlider(data) {
    const yearData = data.filter(d => d.release_year);
    const yearExtent = d3.extent(yearData, d => d.release_year);
    //cleans container before using 
    return createD3RangeSlider({
        containerId: '#year-slider-container', minLabelId: '#year-min-value',
        maxLabelId: '#year-max-value', domain: yearExtent,
        tickFormat: d3.format("d"),
        onBrushEnd: (range) => {
            const roundedRange = [Math.round(range[0]), Math.round(range[1])];
            if (JSON.stringify(currentFilters.yearRange) !== JSON.stringify(roundedRange)) {
                currentFilters.yearRange = roundedRange[0] === yearExtent[0] && roundedRange[1] === yearExtent[1] ? null : roundedRange;
                applyFilters();
            }
        }
    });
}

function setupImdbSlider() {
  return createD3RangeSlider({
    containerId: '#imdb-slider-container',
    minLabelId: '#imdb-min-value',
    maxLabelId: '#imdb-max-value', 
    domain: [1.0, 10.0],
    tickFormat: d3.format(".1f"),
    onBrushEnd: (range) => {
      const formattedRange = [parseFloat(range[0].toFixed(1)), parseFloat(range[1].toFixed(1))];
      currentFilters.imdbRange = formattedRange;
      applyFilters();
    }
  });
}

function setupContentTypeFilter() {
  d3.select('#content-type-filter').on('change', (event) => {
    currentFilters.type = event.target.value;
    applyFilters();
  });
}

function setupGenreFilter() {
  d3.selectAll('#genre-filter-list input[type="checkbox"]').on('change', () => {
    const selected = [];
    d3.selectAll('#genre-filter-list input[type="checkbox"]:checked').each(function() {
      selected.push(d3.select(this.parentNode).text().trim());
    });
    currentFilters.selectedGenres = selected;
    applyFilters();
  });
}

//Collects unique genres.
function populateGenreFilter(data) {
  const genres = new Set(data.flatMap(d => isValidString(d.genres) ? d.genres.split(',').map(g => g.trim()) : []));
  d3.select("#genre-filter-list").selectAll("div")
    .data(Array.from(genres).sort()).enter().append("div")
    .html(d => `<label style="display: flex; align-items: center; cursor: pointer; font-weight: 400;"><input type="checkbox" style="margin-right: 0.5rem;">${d}</label>`);
}

function populateGenreFilter(data) {
  const genres = new Set(
    data.flatMap(d => 
      isValidString(d.genres) ? d.genres.split(',').map(g => 
        g.trim()) : []));

  d3.select("#genre-filter-list")
  .selectAll("div")
  .data(Array.from(genres).sort())
  .enter().append("div").html(d => 
      `<label style="display: flex; align-items: center; cursor: pointer;"><input type="checkbox" style="margin-right: 0.5rem;">${d}</label>`);
}

function renderTimelineFilter(data) {
  const container = d3.select("#timeline-filter");
  container.selectAll("*").remove(); 
  const bounds = container.node().getBoundingClientRect();
  if (bounds.width < 10 || bounds.height < 10) return;
  const margin = { top: 30, right: 30, bottom: 40, left: 30 };
  const width = bounds.width - margin.left - margin.right;
  const height = bounds.height - margin.top - margin.bottom;
  const svg = container.append("svg").append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const yearData = data.filter(d => d.release_year);
  const yearExtent = d3.extent(yearData, d => d.release_year);
  if (!yearExtent[0] || !yearExtent[1]) return; 
  const xScale = d3.scaleLinear().domain(yearExtent).range([0, width]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  const brush = d3.brushX()
    .extent([[0, 0], [width, height]])
    .on("end", ({ selection }) => { if (!selection) return; 
      const [x0, x1] = selection.map(xScale.invert); 
      console.log("Selected years:", Math.round(x0), "-", Math.round(x1)); 
    });

  svg.append("g").attr("class", "brush").call(brush);
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -5).attr("text-anchor", "middle")
    .style("font-size", "1rem")
    .style("font-weight", "600")
    .style("fill", "#334155")
    .text("Filter by Release Year");
}

function renderSankeyChart(data) {
  // Select the container div for the Sankey chart and clear any previous content
  const container = d3.select("#sankey-chart");
  container.selectAll("*").remove();
  // Get the container’s size; if too small, skip rendering
  const bounds = container.node().getBoundingClientRect();
  if (bounds.width < 10 || bounds.height < 10) return;
  // Set margins and calculate the inner width and height for the SVG
  const margin = { top: 40, right: 10, bottom: 10, left: 10 };
  const width = bounds.width - margin.left - margin.right;
  const height = bounds.height - margin.top - margin.bottom;

  // Append SVG to container and apply translation for margins
  const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  // Filter the data to only include valid entries for platform, genre, and audience
  const validData = data.filter(d => 
      isValidString(d.streaming_platform) &&
      isValidString(d.main_genre) && d.main_genre !== 'Unknown' &&
      isValidString(d.age_category)
  );
  // If no valid data exists, display a message and exit
  if (validData.length === 0) {
      svg.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .text("No valid data to display for the Sankey chart.")
          .style("fill", "var(--muted-text)");
      return;
  }

  // Initialize sets and objects to store nodes and links
  const nodes = new Set();
  const links = [];
  const platformGenreLinks = {};
  const genreAgeLinks = {};

  // Populate nodes and links counts from the filtered data
  validData.forEach(d => {
      nodes.add(d.streaming_platform);
      nodes.add(d.main_genre);
      nodes.add(d.age_category);

      // Count the occurrences of each platform→genre pair
      const pgKey = `${d.streaming_platform}|${d.main_genre}`;
      platformGenreLinks[pgKey] = (platformGenreLinks[pgKey] || 0) + 1;
      // Count the occurrences of each genre→audience pair
      const gaKey = `${d.main_genre}|${d.age_category}`;
      genreAgeLinks[gaKey] = (genreAgeLinks[gaKey] || 0) + 1;
  });

  // Convert counted pairs into link objects for the Sankey diagram
  for (const key in platformGenreLinks) {
      const [source, target] = key.split("|");
      links.push({ source, target, value: platformGenreLinks[key] });
  }
  for (const key in genreAgeLinks) {
      const [source, target] = key.split("|");
      links.push({ source, target, value: genreAgeLinks[key] });
  }

  // Initialize the D3 Sankey generator
  const sankey = d3.sankey()
      .nodeId(d => d.name)
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 6]]);

  // Generate nodes and links for the Sankey diagram
  const { nodes: graphNodes, links: graphLinks } = sankey({
      nodes: Array.from(nodes).map(name => ({ name })),
      links: links.map(d => ({ ...d }))
  });

  // Define platform colors
  const platformColors = {
      "Netflix": "#FF0000",    // red
      "Paramount": "#00008B",  // dark blue
      "Amazon": "#FFD700",     // yellow
      "Apple": "#888888",      // gray
      "Disney": "#ADD8E6",     // light blue
      "HBO": "#800080"         // purple
  };

  // Assign colors for genres using a categorical scale
  const genreNames = Array.from(new Set(validData.map(d => d.main_genre)));
  const genreColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(genreNames);

  // Color function: platform → custom, genre → color scale, age → default gray
  const color = d => {
      if (platformColors[d]) return platformColors[d];
      if (genreNames.includes(d)) return genreColorScale(d);
      return "#888888"; // age categories gray
  };

  var div = d3.select("body").append("div")
     .attr("class", "tooltip-donut")
     .style("position", "absolute")
     .style("opacity", 0);
  
  // Draw nodes
  svg.append("g")
      .selectAll("rect")
      .data(graphNodes)
      .join("rect")
      .attr("class", "sankey-node")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("height", d => d.y1 - d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("fill", d => color(d.name))
      .attr('opacity', 0.65)
      .on('mouseover', function (event, d) {
          d3.select(this).transition()
              .duration(50)
              .attr('opacity', 1);

          div.transition()
              .duration(50)
              .style("opacity", 1);

          div.html(d.value)
            .style("left", (event.pageX - 20) + "px")
            .style("top", (event.pageY - 50) + "px");
      })
     .on('mouseout', function (event, d) {
          d3.select(this).transition()
               .duration('50')
               .attr('opacity', 0.65);

          div.transition()
            .duration('50')
            .style("opacity", 0);
      });

  // Draw links
  svg.append("g")
      .attr("fill", "none")
      .selectAll("g")
      .data(graphLinks)
      .join("path")
      .attr("class", "sankey-link")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", d => color(d.source.name))
      .attr("stroke-width", d => Math.max(1, d.width))
      .attr('opacity', 0.65)
      .on('mouseover', function (event, d) {
          d3.select(this).transition()
              .duration(50)
              .attr('opacity', 1);

          div.transition()
              .duration(50)
              .style("opacity", 1);

          div.html(d.value)
              .style("left", (event.pageX - 20) + "px")
              .style("top", (event.pageY - 50) + "px");
      })
     .on('mouseout', function (event, d) {
          d3.select(this).transition()
               .duration('50')
               .attr('opacity', 0.65);

          div.transition()
            .duration('50')
            .style("opacity", 0);
      });

  // Draw node labels
  svg.append("g")
      .selectAll("text")
      .data(graphNodes)
      .join("text")
      .attr("class", "sankey-node")
      .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr("y", d => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
      .text(d => d.name)

  // Chart title
  svg.append("text")
      .attr("x", width / 2)
      .attr("y", -15)
      .attr("text-anchor", "middle")
      .style("font-size", "1rem")
      .style("font-weight", "600")
      .style("fill", "#334155")
      .text("Content Flow: Platform → Genre → Target Audience");
}