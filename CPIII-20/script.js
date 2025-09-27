
const isValidString = (str) => str && typeof str === 'string' && str.trim() !== '';


let allPlatformData = [];
// A constant to hold the default filter state for easy resetting ---
const defaultFilters = {
    type: 'TV Shows & Movies',
    imdbRange: [1.0, 10.0],
    selectedGenres: [],
    yearRange: null,
    selectedAudiences: []
};

let currentFilters = { ...defaultFilters };

// Variables to hold our slider instances so we can reset them ---
let imdbSlider, yearSlider;

document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        d3.csv("streaming_platforms.csv"),
        d3.csv("streaming_prices.csv")
    ]).then(([rawPlatformData, rawPriceData]) => {
      
        const processedPlatformData = rawPlatformData.map(d => ({
            ...d,
            release_year: +d.release_year,
            imdb_score: +d.imdb_score,
            type: d.type,
            genres: d.genres || '',
            age_category: d.age_category || 'Unknown',
            main_genre: isValidString(d.genres) ? d.genres.split(',')[0].trim() : 'Unknown',
            main_country: isValidString(d.production_countries) ? d.production_countries.split(',')[0].trim() : 'Unknown'
        }));
        
        allPlatformData = processedPlatformData;

        document.getElementById('loading').style.display = 'none';
        document.querySelector('main').style.visibility = 'visible';
    
        setupContentTypeFilter();
        populateGenreFilter(allPlatformData);
        setupGenreFilter();
        imdbSlider = setupImdbSlider(); // Store the returned slider object
        yearSlider = setupYearSlider(allPlatformData); // Store the returned slider object
        setupAudienceFilter();
        setupRemoveFiltersButton();
        
        renderSankeyChart(allPlatformData);

        window.addEventListener('resize', () => { clearTimeout(window.resizeTimer); window.resizeTimer = setTimeout(() => renderSankeyChart(allPlatformData), 250); });

    }).catch(error => console.error("Data loading failed:", error));
});


function applyFilters() {
  let filteredData = allPlatformData;

  if (currentFilters.type === 'TV Shows') filteredData = filteredData.filter(d => d.type === 'SHOW');
  if (currentFilters.type === 'Movies') filteredData = filteredData.filter(d => d.type === 'MOVIE');

  filteredData = filteredData.filter(d => d.imdb_score >= currentFilters.imdbRange[0] && d.imdb_score <= currentFilters.imdbRange[1]);

  if (currentFilters.selectedGenres.length > 0) {
      filteredData = filteredData.filter(d => currentFilters.selectedGenres.includes(d.main_genre));
  }

  if (currentFilters.yearRange) {
      filteredData = filteredData.filter(d => d.release_year >= currentFilters.yearRange[0] && d.release_year <= currentFilters.yearRange[1]);
  }

  if (currentFilters.selectedAudiences.length > 0) {
      filteredData = filteredData.filter(d => currentFilters.selectedAudiences.includes(d.age_category));
  }

  renderSankeyChart(filteredData);
}

// --- NEW: Function to set up the 'Remove All Filters' button ---
function setupRemoveFiltersButton() {
  d3.select('.remove-filters-btn').on('click', () => {
    // 1. Reset the state object
    currentFilters = { ...defaultFilters };

    // 2. Reset the UI controls
    d3.select('#content-type-filter').property('value', defaultFilters.type);
    d3.selectAll('#genre-filter-list input[type="checkbox"]').property('checked', false);
    d3.selectAll('.audience-buttons button').classed('active', false);
    
    // Reset the sliders using their returned methods
    if (imdbSlider) imdbSlider.reset();
    if (yearSlider) yearSlider.reset();

    // 3. Apply the cleared filters to re-render the chart
    applyFilters();
  });
}


function setupAudienceFilter() {
  // ... (this function remains the same)
  const audienceMap = {
    'Toddler': 'toddlers', 'Children': 'child',
    'Teen': 'teenager', 'Adult': 'adult'
  };

  d3.selectAll('.audience-buttons button').on('click', function() {
    const button = d3.select(this);
    button.classed('active', !button.classed('active'));
    const selected = [];
    d3.selectAll('.audience-buttons button.active').each(function() {
        const buttonText = d3.select(this).text();
        const dataValue = audienceMap[buttonText];
        if (dataValue) selected.push(dataValue);
    });
    currentFilters.selectedAudiences = selected;
    applyFilters();
  });
}

// --- MODIFIED: The slider creator now returns a reset function ---
function createD3RangeSlider(config) {
  const container = d3.select(config.containerId);
  container.selectAll("*").remove();

  const margin = { top: 10, right: 15, bottom: 20, left: 15 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 50 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain(config.domain).range([0, width]).clamp(true);

  svg.append("g").attr("class", "axis").attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(config.ticks || 5).tickFormat(config.tickFormat));

  const brush = d3.brushX().extent([[0, 0], [width, height]])
    .on("end", (event) => {
      let valueRange = event.selection ? event.selection.map(xScale.invert) : config.domain;
      config.onBrushEnd(valueRange);
    });

  const gBrush = svg.append("g").attr("class", "brush").call(brush);
  gBrush.call(brush.move, config.domain.map(xScale));

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
  const yearData = data.filter(d => d.release_year && d.release_year > 1900);
  const yearExtent = d3.extent(yearData, d => d.release_year);

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
    containerId: '#imdb-slider-container', minLabelId: '#imdb-min-value',
    maxLabelId: '#imdb-max-value', domain: [1.0, 10.0],
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

function populateGenreFilter(data) {
  const genres = new Set(data.flatMap(d => isValidString(d.genres) ? d.genres.split(',').map(g => g.trim()) : []));
  d3.select("#genre-filter-list").selectAll("div")
    .data(Array.from(genres).sort()).enter().append("div")
    .html(d => `<label style="display: flex; align-items: center; cursor: pointer; font-weight: 400;"><input type="checkbox" style="margin-right: 0.5rem;">${d}</label>`);
}

function renderAllVisualizations(data) {
  renderTimelineFilter(data);
  renderSankeyChart(data);
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
  const yearData = data.filter(d => d.release_year && d.release_year > 1900);
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
  const container = d3.select("#sankey-chart");
  container.selectAll("*").remove();
  const bounds = container.node().getBoundingClientRect();
  if (bounds.width < 10 || bounds.height < 10) return;

  const margin = { top: 40, right: 10, bottom: 10, left: 10 };
  const width = bounds.width - margin.left - margin.right;
  const height = bounds.height - margin.top - margin.bottom;

  const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  const validData = data.filter(d => 
      isValidString(d.streaming_platform) &&
      isValidString(d.main_genre) && d.main_genre !== 'Unknown' &&
      isValidString(d.age_category)
  );

  if (validData.length === 0) {
      svg.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .text("No valid data to display for the Sankey chart.")
          .style("fill", "var(--muted-text)");
      return;
  }

  const nodes = new Set();
  const links = [];
  const platformGenreLinks = {};
  const genreAgeLinks = {};

  validData.forEach(d => {
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

  const sankey = d3.sankey()
      .nodeId(d => d.name)
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 6]]);

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
      .attr("fill", d => color(d.name));

  // Draw links
  svg.append("g")
      .attr("fill", "none")
      .selectAll("g")
      .data(graphLinks)
      .join("path")
      .attr("class", "sankey-link")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", d => color(d.source.name))
      .attr("stroke-width", d => Math.max(1, d.width));

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
      .text(d => d.name);

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