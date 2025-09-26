// ==========================================================
// TIMELINE FILTER (Brush Slider)
// ==========================================================
function renderTimelineFilter() {
  const container = d3.select("#timeline-filter");
  container.selectAll("*").remove();

  const bounds = container.node().getBoundingClientRect();
  const margin = { top: 50, right: 30, bottom: 50, left: 30 };
  const width = bounds.width - margin.left - margin.right;
  const height = 80;

  const svg = container.append("svg")
      .attr("width", bounds.width)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${bounds.width} ${height + margin.top + margin.bottom}`)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  const years = d3.range(1930, 2023);
  const xScale = d3.scaleLinear()
    .domain(d3.extent(years))
    .range([0, width]);

  // Axis (responsive font size)
  const fontSize = Math.max(10, width * 0.015);
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
    .selectAll("text")
      .style("font-size", fontSize + "px");

  // Brush
  const brush = d3.brushX()
    .extent([[0, 0], [width, height]])
    .on("end", ({ selection }) => {
      if (!selection) return;
      const [x0, x1] = selection.map(xScale.invert);
      console.log("Selected years:", Math.round(x0), "-", Math.round(x1));
      // TODO: filter your charts with selected years
    });

  svg.append("g").attr("class", "brush").call(brush);
}

renderTimelineFilter();


// ==========================================================
// PRICE CHART (Line Chart with Arrows)
// ==========================================================
(function renderPriceChart() {
  const margin = { top: 50, right: 50, bottom: 80, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = d3.select("#price-chart")
    .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  // Arrow marker
  svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 5)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("class", "arrowhead-path");

  d3.csv("streaming_prices.csv").then(function(data) {
    data.forEach(d => {
      d.year = +d.year;
      d.price = +d.price;
    });

    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.price) * 1.1])
      .range([height, 0]);

    const [minYear, maxYear] = xScale.domain();
    const yearTicks = d3.range(Math.ceil(minYear), Math.floor(maxYear) + 1);

    const fontSize = Math.max(10, width * 0.015);

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(xScale).tickValues(yearTicks).tickFormat(d3.format("d")))
      .selectAll("text")
        .style("font-size", fontSize + "px");

    // Y Axis
    svg.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
        .style("font-size", fontSize + "px");

    // Labels
    svg.append("text")
      .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 20})`)
      .style("text-anchor", "middle")
      .style("font-size", fontSize + "px")
      .text("Year");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 15)
      .attr("x", -height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", fontSize + "px")
      .text("Price (USD)");

    // Arrowheads on axes
    svg.selectAll(".domain").attr("marker-end", "url(#arrowhead)");

    // Lines
    const dataByPlatform = d3.group(data, d => d.streaming_platform);
    const color = d3.scaleOrdinal()
      .domain(Array.from(dataByPlatform.keys()))
      .range(['#E50914', '#0070D1', '#FF9900', '#1C729D', '#000000', '#90EE90']);

    const lineGenerator = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.price));

    svg.selectAll(".line")
      .data(dataByPlatform)
      .enter()
      .append("path")
        .attr("class", "line")
        .attr("d", d => lineGenerator(d[1].sort((a, b) => a.year - b.year)))
        .style("stroke", d => color(d[0]))
        .style("stroke-width", Math.max(2, width * 0.004));
  });
})();


// ==========================================================
// QUANTITY CHART (Dot Dumbbell Plot)
// ==========================================================
(function renderQuantityChart() {
  const margin = { top: 40, right: 30, bottom: 40, left: 70 };
  const width = 800 - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = d3.select("#quantity-chart")
    .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  d3.csv("streaming_platform_final.csv").then(function(data) {
    const aggregatedData = Array.from(d3.group(data, d => d.streaming_platform), ([platform, platformData]) => {
      const tvShows = platformData.filter(d => d.type === "SHOW").length;
      const movies = platformData.filter(d => d.type === "MOVIE").length;
      return { platform, tvShows, movies };
    });

    const validPlatforms = aggregatedData.filter(d => d.tvShows > 0 || d.movies > 0);
    const platforms = validPlatforms.map(d => d.platform);

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(validPlatforms, d => Math.max(d.tvShows, d.movies)) * 1.1])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(platforms)
      .range([0, height])
      .padding(0.8);

    const fontSize = Math.max(10, width * 0.015);
    const circleRadius = Math.max(4, width * 0.008);

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
      .selectAll("text")
        .style("font-size", fontSize + "px");

    // Y Axis
    svg.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
        .style("font-size", fontSize + "px");

    // Title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -margin.top / 2)
      .attr("text-anchor", "middle")
      .style("font-size", fontSize * 1.2 + "px")
      .style("font-weight", "bold")
      .text("Content Quantity per Platform");

    // Horizontal dashed lines
    svg.selectAll(".platform-line")
      .data(platforms)
      .enter()
      .append("line")
        .attr("x1", 0)
        .attr("y1", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("x2", xScale(d3.max(validPlatforms, d => Math.max(d.tvShows, d.movies)) * 1.1))
        .attr("y2", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "4 4");

    // Dumbbells
    validPlatforms.forEach(p => {
      svg.append("line")
        .attr("x1", xScale(p.tvShows))
        .attr("y1", yScale(p.platform) + yScale.bandwidth() / 2)
        .attr("x2", xScale(p.movies))
        .attr("y2", yScale(p.platform) + yScale.bandwidth() / 2)
        .attr("stroke", "#333")
        .attr("stroke-width", Math.max(2, width * 0.003));

      svg.append("circle")
        .attr("cx", xScale(p.tvShows))
        .attr("cy", yScale(p.platform) + yScale.bandwidth() / 2)
        .attr("r", circleRadius)
        .attr("fill", "steelblue");

      svg.append("circle")
        .attr("cx", xScale(p.movies))
        .attr("cy", yScale(p.platform) + yScale.bandwidth() / 2)
        .attr("r", circleRadius)
        .attr("fill", "hotpink");
    });

    // Legend
    const legendData = [
      { label: "TV Shows", color: "steelblue" },
      { label: "Movies", color: "hotpink" }
    ];

    const legend = svg.append("g")
      .attr("transform", `translate(${width + 20}, 0)`);

    legend.selectAll("rect")
      .data(legendData)
      .enter()
      .append("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", d => d.color);

    legend.selectAll("text")
      .data(legendData)
      .enter()
      .append("text")
        .attr("x", 15)
        .attr("y", (d, i) => i * 20 + 9)
        .text(d => d.label)
        .style("font-size", fontSize + "px")
        .attr("alignment-baseline", "middle");
  });
})();


// ==========================================================
// TREEMAP (Production by Country)
// ==========================================================
(function renderTreemap() {
  const container = d3.select("#treemap-chart");
  const bounds = container.node().getBoundingClientRect();
  const margin = { top: 40, right: 10, bottom: 10, left: 10 };
  const width = bounds.width - margin.left - margin.right;
  const height = bounds.height - margin.top - margin.bottom;

  const svg = container.append("svg")
      .attr("width", bounds.width)
      .attr("height", bounds.height)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  d3.csv("streaming_platform_final.csv").then(function(data) {
    const countryCounts = d3.rollup(
      data,
      v => v.length,
      d => d.production_countries ? d.production_countries.split(",")[0] : "Unknown"
    );

    const hierarchicalData = {
      name: "root",
      children: Array.from(countryCounts, ([key, value]) => ({ name: key, value }))
    };

    const root = d3.hierarchy(hierarchicalData)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);

    d3.treemap().size([width, height]).padding(2)(root);

    const fontSize = Math.max(10, width * 0.015);
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    svg.selectAll("g.node")
      .data(root.leaves())
      .enter()
      .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
      .call(g => {
        g.append("rect")
          .attr("width", d => d.x1 - d.x0)
          .attr("height", d => d.y1 - d.y0)
          .style("fill", d => color(d.data.name));

        g.append("text")
          .attr("x", 5)
          .attr("y", 15)
          .text(d => d.data.name)
          .style("font-size", fontSize + "px")
          .style("fill", "white")
          .style("font-weight", "bold")
          .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.5)");

        g.append("title")
          .text(d => `${d.data.name}\n${d.data.value} titles`);
      });
  });
})();