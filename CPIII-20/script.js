
const isValidString = (str) => str && typeof str === 'string' && str.trim() !== '';

document.addEventListener('DOMContentLoaded', () => {
  const loadingEl = document.getElementById('loading');
  const mainEl = document.querySelector('main');

  Promise.all([
    d3.csv("streaming_platforms.csv"),
    d3.csv("streaming_prices.csv")
  ]).then(([rawPlatformData, rawPriceData]) => {
      
  const platformData = rawPlatformData.map(d => ({
      ...d,
      release_year: +d.release_year,
      imdb_score: +d.imdb_score,
      main_genre: isValidString(d.genres) ? d.genres.split(',')[0].trim() : 'Unknown',
      main_country: isValidString(d.production_countries) ? d.production_countries.split(',')[0].trim() : 'Unknown'
  }));

  const priceData = rawPriceData.map(d => ({ ...d, year: +d.year, price: +d.price }));

  loadingEl.style.display = 'none';
  mainEl.style.visibility = 'visible';

  populateGenreFilter(platformData);
  setupImdbSlider();
  renderAllVisualizations(platformData);

  window.addEventListener('resize', () => { clearTimeout(window.resizeTimer); window.resizeTimer = setTimeout(renderAllVisualizations, 250); }); //não me parece funcionar

  }).catch(error => {
      console.error("Data loading failed:", error);
      loadingEl.innerHTML = `<div style="text-align: center; color: #b91c1c; font-weight: 600;"><p>Error loading data!</p><p style="margin-top: 0.5rem; font-size: 0.875rem; color: #475569;">Did you start a local web server? Check the console for errors.</p></div>`;
  });
});

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

function setupImdbSlider() {
  const slider = document.getElementById('imdb-slider');
  const sliderValue = document.getElementById('imdb-slider-value');
  slider.addEventListener('input', () => { sliderValue.textContent = parseFloat(slider.value).toFixed(1); });
  sliderValue.textContent = parseFloat(slider.value).toFixed(1);
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
  const genreNames = Array.from(nodes).filter(n => !platformColors[n] && !["G", "PG", "PG-13", "R", "NC-17"].includes(n)); // adjust age categories if needed
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