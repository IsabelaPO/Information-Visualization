
//checks if string exists and not just whitespace
const isValidString = (str) => str && typeof str === 'string' && str.trim() !== '';

//stores all platform data
let allPlatformData = [];
let allPriceData = [];

//sets platform colors
const platformColors = {
    "Netflix": "#E50914", 
    "Amazon": "#FF9900", 
    "Disney": "#113CCF",
    "HBO": "#9068F4", 
    "Paramount": "#0090FF", 
    "Apple": "#A2AAAD"
};

const typeFilterColors = {
  "SHOW": "#228B22",
  "MOVIE": "#8bbb8bc5"
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
    main_genre: isValidString(d.genres) ? d.genres.split(',')[0].trim() : 'Unknown' ,
    main_country: isValidString(d.production_countries) ? d.production_countries.split(',')[0].trim() : 'Unknown'
  }));

  const processedPriceData = rawPriceData.map(d => ({ 
    ...d, 
    year: +d.year, 
    price: +d.price 
  }));
  //stores the processed data
  allPlatformData = processedPlatformData;
  allPriceData = processedPriceData;

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
  renderAllVisualizations(allPlatformData, allPriceData);

  window.addEventListener('resize', () => { clearTimeout(window.resizeTimer); window.resizeTimer = setTimeout(() => renderAllVisualizations(allPlatformData, allPriceData), 250); });
  //Re-renders chart on window resize (with debounce)

  }).catch(error => console.error("Data loading failed:", error));
});

function renderAllVisualizations(data, price) {
  renderSankeyChart(data);
  renderQuantityChart(data);
  renderPriceChart(price);
}

function applyFilters() {
  let filteredPlatformData = allPlatformData;
  let filteredPriceData = allPriceData;
  //filter platform
  if (currentFilters.selectedPlatforms.length > 0) {
      filteredPlatformData = filteredPlatformData.filter(d => currentFilters.selectedPlatforms.includes(d.streaming_platform));
      filteredPriceData = filteredPriceData.filter(d => currentFilters.selectedPlatforms.includes(d.streaming_platform));
  }

  if (currentFilters.type.length > 0) {
      filteredPlatformData = filteredPlatformData.filter(d => currentFilters.type.includes(d.type));
  }
  
  //filter imdb range
  filteredPlatformData = filteredPlatformData.filter(d => d.imdb_score >= currentFilters.imdbRange[0] && d.imdb_score <= currentFilters.imdbRange[1]);

  //filter by genre
  if (currentFilters.selectedGenres.length > 0) {
      filteredPlatformData = filteredPlatformData.filter(d => currentFilters.selectedGenres.includes(d.main_genre));
  }

  //filter by year
  if (currentFilters.yearRange) {
      filteredPlatformData = filteredPlatformData.filter(d => d.release_year >= currentFilters.yearRange[0] && d.release_year <= currentFilters.yearRange[1]);
      filteredPriceData = filteredPriceData.filter(d => d.year >= (currentFilters.yearRange[0]) && d.year <= currentFilters.yearRange[1]);
  }

  //filter target audience 
  if (currentFilters.selectedAudiences.length > 0) {
      filteredPlatformData = filteredPlatformData.filter(d => currentFilters.selectedAudiences.includes(d.age_category));
  }

  //re-render charts
  renderAllVisualizations(filteredPlatformData, filteredPriceData);
}

// --- NEW: Function to set up the 'Remove All Filters' button ---
function setupRemoveFiltersButton() {
  d3.select('.remove-filters-btn').on('click', () => {
    // 1. Reset the state object
    currentFilters = { ...defaultFilters };

    // 2. Reset the UI controls
    d3.selectAll('.content-type-filter button').classed('active', false).classed('inactive', false);
    d3.selectAll('.platform-buttons button').classed('active', false).classed('inactive', false);
    d3.selectAll('#genre-filter-list input[type="checkbox"]').property('checked', false);
    d3.selectAll('.audience-buttons button').classed('active', false).classed('inactive', false);
    
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
  //when a button is clicked, it toggles to active class (for css)
  d3.selectAll('.audience-buttons button').on('click', function() {
      const button = d3.select(this);

      //visually marks the button as selected/unselected
      button.classed('active', !button.classed('active'));
      //iterates through active buttons, collects values into selected array
      //saves the array into currentFilters
      const selected = [];
      d3.selectAll('.audience-buttons button.active').each(function() {
          selected.push(d3.select(this).attr('audience-buttons'));
      });
      currentFilters.selectedAudiences = selected;
      const anyFilterActive = selected.length > 0;
      d3.selectAll('.audience-buttons button').each(function() {
          const btn = d3.select(this);
          const audience = btn.attr('audience-buttons');
          //if one platform is active keep those selected as "active" and
          //mark all non-selected buttons as "inactive"
          if (anyFilterActive) {
              const isActive = selected.includes(audience);
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

function setupContentTypeFilter() {
  d3.selectAll('.content-type-filter button').each(function() {
    const type = d3.select(this).attr('content-type-filter');
    if (typeFilterColors[type]) {
        d3.select(this).style('background-color', typeFilterColors[type]);
    }
  });

  d3.selectAll('.content-type-filter button').on('click', function() {
      const button = d3.select(this);
      //visually marks the button as selected/unselected
      button.classed('active', !button.classed('active'));
      const selected = [];
      d3.selectAll('.content-type-filter button.active').each(function() {
          selected.push(d3.select(this).attr('content-type-filter'));
      });
      currentFilters.type = selected;
      const anyFilterActive = selected.length > 0;
      d3.selectAll('.content-type-filter button').each(function() {
          const btn = d3.select(this);
          const typeaux = btn.attr('content-type-filter');
          if (anyFilterActive) {
              const isActive = selected.includes(typeaux);
              btn.classed('active', isActive);
              btn.classed('inactive', !isActive);
          } else {
              btn.classed('active', false);
              btn.classed('inactive', false);
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
  const slider = createD3RangeSlider({
      containerId: '#year-slider-container',
      minLabelId: '#year-min-value',
      maxLabelId: '#year-max-value',
      domain: yearExtent,
      tickFormat: d3.format("d"),
      onBrushEnd: (range) => {
          const roundedRange = [Math.round(range[0]), Math.round(range[1])];
          if (JSON.stringify(currentFilters.yearRange) !== JSON.stringify(roundedRange)) {
              currentFilters.yearRange = roundedRange[0] === yearExtent[0] && roundedRange[1] === yearExtent[1] ? null : roundedRange;
              applyFilters();
          }
      }
  });

  // Set the min and max labels
  d3.select('#year-min-value').text(yearExtent[0]);
  d3.select('#year-max-value').text(yearExtent[1]);

  return slider;
}

function setupImdbSlider() {
  const slider = createD3RangeSlider({
    containerId: '#imdb-slider-container',
    domain: [1.0, 10.0],
    tickFormat: d3.format(".1f"),
    showTickLabels: true, // show labels along ticks
    onBrushEnd: (range) => {
      const formattedRange = [parseFloat(range[0].toFixed(1)), parseFloat(range[1].toFixed(1))];
      currentFilters.imdbRange = formattedRange;
      applyFilters();
    }
  });

  // Remove the max tick label
  d3.select('#imdb-slider-container')
    .selectAll('.tick text')
    .filter(d => d === 10) // filter the max value
    .text('');             // remove its text

  return slider;
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
  const genres = new Set(
    data.flatMap(d => 
      isValidString(d.genres) ? d.genres.split(',').map(g => 
        g.trim()) : []));

  d3.select("#genre-filter-list")
    .selectAll("div")
    .data(Array.from(genres).sort())
    .enter().append("div").html(d => 
        `<label style="display: flex; align-items: center; cursor: pointer; font-weight: normal;"><input type="checkbox" style="margin-right: 0.5rem;">${d}</label>`);
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

function renderQuantityChart(data) {
    const container = d3.select("#quantity-chart");
    container.selectAll("*").remove();

    if (data.length === 0) return;

    const bounds = container.node().getBoundingClientRect();
    if (bounds.width < 10 || bounds.height < 10) return;

    const margin = { top: 40, right: 30, bottom: 40, left: 100 };
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    // 1. Define a transition object
    const t = d3.transition().duration(750);

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Aggregate data: count TV Shows and Movies per platform ---
    const aggData = Array.from(
        d3.group(
            data.filter(d => isValidString(d.streaming_platform)),
            d => d.streaming_platform
        ),
        ([platform, values]) => ({
            platform,
            tvShows: values.filter(d => d.type === "SHOW").length,
            movies: values.filter(d => d.type === "MOVIE").length
        })
    );

    if (aggData.length === 0) return;

    // --- Scales ---
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(aggData, d => Math.max(d.tvShows, d.movies)) * 1.1])
        .range([0, width]);

    const yScale = d3.scaleBand()
        .domain(aggData.map(d => d.platform))
        .range([0, height])
        .padding(0.6);

    // --- Axes (Adding transition to axis calls for smooth domain updates) ---
    svg.select(".x-axis").transition(t).call(d3.axisBottom(xScale).ticks(5));
    svg.select(".y-axis").transition(t).call(d3.axisLeft(yScale));

    // Append axes if they don't exist
    svg.selectAll(".x-axis").data([0]).join("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).ticks(5));

    svg.selectAll(".y-axis").data([0]).join("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale));

    // --- Dumbbell chart groups ---
    const groups = svg.selectAll("g.dumbbell")
        .data(aggData, d => d.platform) // Key function for smooth transitions
        .join(
            enter => enter.append("g").attr("class", "dumbbell"),
            update => update,
            exit => exit.remove()
        )
        .attr("transform", d => `translate(0, 0)`); // Keep groups static for axis transitions

    var div = d3.select("body").append("div")
     .attr("class", "tooltip-donut")
     .style("position", "absolute")
     .style("opacity", 0);

    // --- 2. Line between tvShows and movies (animated) ---
    groups.selectAll(".dumbbell-line")
        .data(d => [d]) // Bind the group data to the line
        .join("line")
        .attr("class", "dumbbell-line")
        // Apply transition to attributes
        .transition(t)
        .attr("x1", d => xScale(d.tvShows))
        .attr("y1", d => yScale(d.platform) + yScale.bandwidth() / 2)
        .attr("x2", d => xScale(d.movies))
        .attr("y2", d => yScale(d.platform) + yScale.bandwidth() / 2)
        .style("stroke", d => platformColors[d.platform])
        .attr("stroke-width", 2);

    // Add tooltips back *after* the join/transition for correct event handling
    groups.selectAll(".dumbbell-line")
        .on('mouseover', function (event, d) {
          d3.select(this).transition().duration(50).attr('opacity', 1);
          div.transition().duration(50).style("opacity", 1);
          div.html(`
            <div>Platform: ${d.platform}</div>
            <div>Total content: ${d.tvShows + d.movies}</div>
            `).style("text-align", "left")
          const bbox = div.node().getBoundingClientRect();
          div.style("left", (event.pageX - bbox.width / 2) + "px").style("top", (event.pageY - bbox.height - 10) + "px");
      })
     .on('mouseout', function (event, d) {
          d3.select(this).transition().duration('50').attr('opacity', 0.65);
          div.transition().duration('50').style("opacity", 0);
      });

    // --- 3. TV Shows circle (animated) ---
    groups.selectAll(".tv-show-circle")
        .data(d => [d])
        .join("circle")
        .attr("class", "tv-show-circle")
        .attr("r", 6)
        .attr("fill", typeFilterColors.SHOW)
        // Apply transition to attributes
        .transition(t)
        .attr("cx", d => xScale(d.tvShows))
        .attr("cy", d => yScale(d.platform) + yScale.bandwidth() / 2);
    
    // Add tooltips back
    groups.selectAll(".tv-show-circle")
        .on('mouseover', function (event, d) {
          d3.select(this).transition().duration(50).attr('opacity', 1);
          div.transition().duration(50).style("opacity", 1);
          div.html(`
              <div>Platform: ${d.platform}</div>
              <div>TV Show: ${d.tvShows}</div>
            `).style("text-align", "left");
          const bbox = div.node().getBoundingClientRect();
          div.style("left", (event.pageX - bbox.width / 2) + "px").style("top", (event.pageY - bbox.height - 10) + "px");
      })
     .on('mouseout', function (event, d) {
          d3.select(this).transition().duration('50').attr('opacity', 0.65);
          div.transition().duration('50').style("opacity", 0);
      });

    // --- 4. Movies circle (animated) ---
    groups.selectAll(".movie-circle")
        .data(d => [d])
        .join("circle")
        .attr("class", "movie-circle")
        .attr("r", 6)
        .attr("fill", typeFilterColors.MOVIE)
        // Apply transition to attributes
        .transition(t)
        .attr("cx", d => xScale(d.movies))
        .attr("cy", d => yScale(d.platform) + yScale.bandwidth() / 2);

    // Add tooltips back
    groups.selectAll(".movie-circle")
        .on('mouseover', function (event, d) {
          d3.select(this).transition().duration(50).attr('opacity', 1);
          div.transition().duration(50).style("opacity", 1);
          div.html(`
              <div>Platform: ${d.platform}</div>
              <div>Movie: ${d.movies}</div>
            `).style("text-align", "left");
          const bbox = div.node().getBoundingClientRect();
          div.style("left", (event.pageX - bbox.width / 2) + "px").style("top", (event.pageY - bbox.height - 10) + "px");
      })
     .on('mouseout', function (event, d) {
          d3.select(this).transition().duration('50').attr('opacity', 0.65);
          div.transition().duration('50').style("opacity", 0);
      });

    // --- Chart title ---
    svg.selectAll(".chart-title")
        .data(["Movies vs. TV Shows"])
        .join("text")
        .attr("class", "chart-title")
        .attr("x", width / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .style("font-size", "1rem")
        .style("font-weight", "600")
        .style("fill", "#334155")
        .text(d => d);
}

function renderPriceChart(data) {
  const container = d3.select("#price-chart");
  container.selectAll("*").remove();
  //if (data.length === 0) return;
  const bounds = container.node().getBoundingClientRect();
  if (bounds.width < 10 || bounds.height < 10) return;
  const margin = { top: 40, right: 30, bottom: 50, left: 50 };
  const width = bounds.width - margin.left - margin.right;
  const height = bounds.height - margin.top - margin.bottom;
  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right) // Added width to SVG
    .attr("height", height + margin.top + margin.bottom) // Added height to SVG
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  const t = svg.transition().duration(1000); 

  const xScale = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([0, width]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.price) * 1.1]).range([height, 0]);
  
  // Update axes with transition
  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(5)
    .tickFormat(d3.format("d"))
  );
  svg.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale)
    .ticks(5)
    .tickFormat(d => `$${d}`)
  );
  
  const dataByPlatform = d3.group(data.filter(d => isValidString(d.streaming_platform)), d => d.streaming_platform);
  var div = d3.select("body").append("div")
     .attr("class", "tooltip-donut")
     .style("position", "absolute")
     .style("opacity", 0);
  const lineGenerator = d3.line().x(d => xScale(d.year)).y(d => yScale(d.price));
  
  // Line drawing logic with animation
  const lines = svg.selectAll(".line")
    .data(dataByPlatform)
    .join(
        enter => enter.append("path")
            .attr("class", "line")
            .attr("d", d => lineGenerator(d[1].sort((a, b) => a.year - b.year)))
            .style("stroke", d => platformColors[d[0]])
            .on('mouseover', function (event, d) {
                d3.select(this).transition().duration(50).attr('opacity', 1);
                div.transition().duration(50).style("opacity", 1);
                div.html(`<div>Platform: ${d[0]}</div>`).style("text-align", "left");
                const bbox = div.node().getBoundingClientRect();
                div.style("left", (event.pageX - bbox.width / 2) + "px").style("top", (event.pageY - bbox.height - 10) + "px");
            })
            .on('mouseout', function (event, d) {
                d3.select(this).transition().duration('50').attr('opacity', 0.65);
                div.transition().duration('50').style("opacity", 0);
            })
          
            .each(function(d) {
                const totalLength = this.getTotalLength();
                d3.select(this)
                    .attr("stroke-dasharray", totalLength + " " + totalLength)
                    .attr("stroke-dashoffset", totalLength);
            })
            .call(enter => enter.transition(t).attr("stroke-dashoffset", 0)),
            
        update => update
            .call(update => update.transition(t)
                .attr("d", d => lineGenerator(d[1].sort((a, b) => a.year - b.year)))
                .style("stroke", d => platformColors[d[0]])
            )
            .on('mouseover', function (event, d) {
                d3.select(this).transition().duration(50).attr('opacity', 1);
                div.transition().duration(50).style("opacity", 1);
                div.html(`<div>Platform: ${d[0]}</div>`).style("text-align", "left");
                const bbox = div.node().getBoundingClientRect();
                div.style("left", (event.pageX - bbox.width / 2) + "px").style("top", (event.pageY - bbox.height - 10) + "px");
            })
            .on('mouseout', function (event, d) {
                d3.select(this).transition().duration('50').attr('opacity', 0.65);
                div.transition().duration('50').style("opacity", 0);
            }),
            
        exit => exit.call(exit => exit.transition(t).attr("opacity", 0).remove())
    );

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -15)
    .attr("text-anchor", "middle")
    .style("font-size", "1rem")
    .style("font-weight", "600")
    .style("fill", "#334155")
    .text("Subscription Price Over Time");
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

  svg.attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom);
  const g = svg.select("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const validData = data.filter(d => isValidString(d.streaming_platform) && isValidString(d.main_genre) && d.main_genre !== 'Unknown' && isValidString(d.age_category));
  
  const noDataMessage = svg.selectAll(".no-data-message").data(validData.length === 0 ? [1] : []);
  noDataMessage.enter().append("text").attr("class", "no-data-message")
    .attr("x", bounds.width / 2).attr("y", bounds.height / 2).attr("text-anchor", "middle")
    .text("No data available for the current filter selection.").style("fill", "var(--muted-text)");
  noDataMessage.exit().remove();
  
  svg.selectAll(".links-group, .nodes-group, .labels-group").style("display", validData.length === 0 ? "none" : null);
  if (validData.length === 0) return;

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
  for (const key in platformGenreLinks) { const [source, target] = key.split("|"); links.push({ source, target, value: platformGenreLinks[key] }); }
  for (const key in genreAgeLinks) { const [source, target] = key.split("|"); links.push({ source, target, value: genreAgeLinks[key] }); }

  const sankey = d3.sankey().nodeId(d => d.name).nodeWidth(15).nodePadding(10).extent([[1, 1], [width - 1, height - 6]]);
  const { nodes: graphNodes, links: graphLinks } = sankey({ nodes: Array.from(nodes).map(name => ({ name })), links: links.map(d => ({ ...d })) });

  const genreNames = Array.from(new Set(validData.map(d => d.main_genre)));
  const genreColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(genreNames);
  const color = d => {
    if (platformColors[d.name]) return platformColors[d.name];
    if (genreNames.includes(d.name)) return genreColorScale(d.name);
    return "#8bbb8bc5";
  };
  
  let tooltip = d3.select(".tooltip-donut");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "tooltip-donut")
      .style("position", "absolute")
      .style("opacity", 0);
  }

  const handleMouseOut = function() {
    d3.select(this).transition().duration(50).attr('opacity', 0.65);
    tooltip.transition().duration(50).style("opacity", 0);
  };

  const handleLinkMouseOver = function(event, d) {
    d3.select(this).transition().duration(50).attr('opacity', 1);
    tooltip.transition().duration(50).style("opacity", 1);
    tooltip.html(`Source: ${d.source.name}<br/>Target: ${d.target.name}<br/>Quantity: ${d.value}`)
      .style("left", (event.pageX + 15) + "px")
      .style("top", (event.pageY - 28) + "px");
  };

  const handleNodeMouseOver = function(event, d) {
    d3.select(this).transition().duration(50).attr('opacity', 1);
    tooltip.transition().duration(50).style("opacity", 1);
    tooltip.html(`Total quantity: ${d.value}`)
      .style("left", (event.pageX + 15) + "px")
      .style("top", (event.pageY - 28) + "px");
  };

  const t = svg.transition().duration(750);

  svg.select(".links-group")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .selectAll(".sankey-link")
    .data(graphLinks, d => `${d.source.name}-${d.target.name}`)
    .join(
      enter => enter.append("path").attr("class", "sankey-link").attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => color(d.source)).attr("stroke-width", 0).attr('opacity', 0.65)
        .on('mouseover', handleLinkMouseOver).on('mouseout', handleMouseOut)
        .call(enter => enter.transition(t).attr("stroke-width", d => Math.max(1, d.width))),
      update => update
        .on('mouseover', handleLinkMouseOver).on('mouseout', handleMouseOut)
        .call(update => update.transition(t)
          .attr("stroke", d => color(d.source))
          .attr("d", d3.sankeyLinkHorizontal())
          .attr("stroke-width", d => Math.max(1, d.width))),
      exit => exit.call(exit => exit.transition(t).attr("stroke-width", 0).remove())
    );

  svg.select(".nodes-group")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .selectAll(".sankey-node")
    .data(graphNodes, d => d.name)
    .join(
      enter => enter.append("rect").attr("class", "sankey-node")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("fill", d => color(d))
        .attr('opacity', 0.65)
        .on('mouseover', handleNodeMouseOver).on('mouseout', handleMouseOut)
        .attr("height", 0)
        .call(enter => enter.transition(t).attr("height", d => d.y1 - d.y0)),
      update => update
        .on('mouseover', handleNodeMouseOver).on('mouseout', handleMouseOut)
        .call(update => update.transition(t)
          .attr("fill", d => color(d)) // transition
          .attr("x", d => d.x0).attr("y", d => d.y0)
          .attr("height", d => d.y1 - d.y0)),
      exit => exit.call(exit => exit.transition(t).attr("height", 0).remove())
    );

  const audienceLabels = { adult: "Adult", child: "Children", teenager: "Teenager", toddlers: "Toddler" };
  svg.select(".labels-group")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .selectAll(".sankey-node-label")
    .data(graphNodes, d => d.name)
    .join(
      enter => enter.append("text").attr("class", "sankey-node-label")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6).attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em").attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .text(d => audienceLabels[d.name] || d.name).attr("opacity", 0)
        .call(enter => enter.transition(t).attr("opacity", 1)),
      update => update
        .call(update => update.transition(t)
          .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
          .attr("y", d => (d.y1 + d.y0) / 2).attr("opacity", 1)),
      exit => exit.call(exit => exit.transition(t).attr("opacity", 0).remove())
    );
  
  svg.select(".chart-title")
    .attr("x", width / 2 + margin.left).attr("y", margin.top - 15)
    .attr("text-anchor", "middle")
    .style("font-size", "1rem").style("font-weight", "600").style("fill", "#334155")
    .text("Content Flow: Platform → Genre → Target Audience");
}

