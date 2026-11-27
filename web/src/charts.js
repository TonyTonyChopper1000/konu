import * as d3 from 'd3';

export const fmt = d3.format(',');
export const short = (n) => d3.format('.3~s')(n).replace('G', 'B');

const css = (name) => `var(${name})`;
export const COLORS = [css('--accent'), css('--accent-2'), css('--accent-3')];

// Redraw a chart whenever its box changes width.
export function responsive(el, draw) {
  let last = 0;
  const ro = new ResizeObserver(() => {
    const w = Math.round(el.clientWidth);
    if (w && w !== last) { last = w; draw(w); }
  });
  ro.observe(el);
}

function tooltip(el) {
  return d3.select(el).append('div').attr('class', 'tt').style('display', 'none');
}
function place(tt, el, ev, W) {
  const [mx, my] = d3.pointer(ev, el);
  const tw = tt.node().offsetWidth;
  tt.style('left', Math.max(0, Math.min(mx + 12, W - tw)) + 'px').style('top', Math.max(0, my - 32) + 'px');
}
function textWidth(svg, strings) {
  let w = 0;
  strings.forEach((s) => {
    const t = svg.append('text').text(s);
    w = Math.max(w, t.node().getComputedTextLength());
    t.remove();
  });
  return w;
}

// Horizontal bars. segments: [{value, color, name}] per row for stacked bars.
export function hbar(el, rows, o) {
  responsive(el, (W) => {
    el.replaceChildren();
    const bh = o.barH || 20, gap = 6;
    const H = rows.length * (bh + gap);
    const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', o.aria)
      .attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const total = (r) => o.segments(r).reduce((a, s) => a + s.value, 0);
    let lw = Math.min(textWidth(svg, rows.map(o.label)), W * 0.42);
    const vw = textWidth(svg, rows.map((r) => o.fmt(r)));
    const x0 = lw + 10, x1 = Math.max(x0 + 20, W - vw - 10);
    const x = d3.scaleLinear().domain([0, d3.max(rows, total) || 1]).range([0, x1 - x0]);
    const tt = tooltip(el);
    const g = svg.selectAll('g.r').data(rows).join('g').attr('class', 'r')
      .attr('transform', (d, i) => `translate(0,${i * (bh + gap)})`);
    g.append('text').attr('x', lw).attr('y', bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(o.label);
    g.each(function (d) {
      let acc = 0;
      o.segments(d).forEach((s) => {
        d3.select(this).append('rect').attr('x', x0 + x(acc)).attr('height', bh).attr('rx', 2)
          .attr('width', Math.max(s.value ? 1 : 0, x(s.value))).style('fill', s.color);
        acc += s.value;
      });
    });
    g.append('text').attr('class', 'vlabel').attr('x', (d) => x0 + x(total(d)) + 6)
      .attr('y', bh / 2).attr('dy', '0.35em').text((d) => o.fmt(d));
    g.append('rect').attr('y', -gap / 2).attr('width', W).attr('height', bh + gap).style('fill', 'transparent')
      .on('mousemove', function (ev, d) { tt.style('display', 'block').text(o.tip(d)); place(tt, el, ev, W); })
      .on('mouseleave', () => tt.style('display', 'none'));
  });
}

export function simpleBars(el, rows, { label, value, fmtv = short, unit, aria, color = COLORS[0], barH }) {
  hbar(el, rows, {
    label, aria, barH,
    segments: (r) => [{ value: value(r), color }],
    fmt: (r) => fmtv(value(r)),
    tip: (r) => `${label(r)}: ${fmt(value(r))} ${unit}`,
  });
}

// Multi-series line chart over years.
export function lines(el, data, series, aria) {
  responsive(el, (W) => {
    el.replaceChildren();
    const H = 280, m = { t: 10, r: 14, b: 26, l: 44 };
    const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.year)).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d3.max(series, (k) => d[k])) || 1]).nice().range([H - m.b, m.t]);
    const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', aria)
      .attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(d3.format('~s')));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(Math.max(2, Math.min(10, Math.floor((W - m.l) / 60)))).tickFormat(d3.format('d')));
    series.forEach((k, i) => {
      svg.append('path').datum(data).attr('fill', 'none').style('stroke', COLORS[i]).attr('stroke-width', 2)
        .attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d[k])));
    });
    const tt = tooltip(el);
    const v = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--muted)').style('display', 'none');
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b)
      .style('fill', 'transparent')
      .on('mousemove', function (ev) {
        const yr = Math.round(x.invert(d3.pointer(ev, el)[0]));
        const d = data.find((r) => r.year === yr);
        if (!d) { tt.style('display', 'none'); v.style('display', 'none'); return; }
        v.attr('x1', x(yr)).attr('x2', x(yr)).style('display', null);
        tt.style('display', 'block').text(`${yr}: ` + series.map((k) => `${k.split(' ')[0].toLowerCase()} ${fmt(d[k])}`).join(' · '));
        place(tt, el, ev, W);
      })
      .on('mouseleave', () => { tt.style('display', 'none'); v.style('display', 'none'); });
  });
}
