var $ = require("jquery");
require('intersection-observer');
const scrollama = require('scrollama');
const d3 = require('d3');
const chroma = require('chroma-js');
const tippy = require('tippy.js');

var man_scale = chroma
    .scale(['#eebeff', '#9b00b7'])
    .mode('hsl')
    .domain([0.2, 1]);

const spin_col = man_scale(0.4),
    vata_col = man_scale(0.8),
    neut_col = '#a0a0a0',
    font_col = $('body').css('color');

var svg_wire_vru = d3.select('#wire_vru svg')
    .attr('viewBox', '-500 -500 1000 1000');

var sites_list = d3.select('#sites #sites_list');

var canvas = d3.select("#topic_viz canvas");

// Timeline settings
var parseDateTime = d3.timeParse('%Y-%m-%d %H:%M:%S %Z');
var date_str_fmt = d3.timeFormat('%Y-%m-%d');
var print_date_fmt = d3.timeFormat('%d/%m/%y %H:%M');
var tline_time_scale = d3.scaleLinear()
    .domain([0, 86400])
    .range([0, 360]);

var tline_R_scale = d3.scaleTime()
    .domain([new Date('2018-08-14'), new Date('2018-08-19')])
    .range([100, 450])
    .clamp(true);

var pub2R = function (t) {  return tline_R_scale( new Date(t) )  };

var trans = d3.transition();

var fullscreen_fig = function (scroller=null) {

    if ($(document).width() <= 576) {
        d3.select('#wire_vru svg')
            .attr('height', function () {
                return d3.min([
                    ( window.innerHeight - $(this).closest('section').find('.h3').height() ) / 3 * 2,
                    window.innerWidth
                ]);
            })
            .attr('width', function () { return this.getAttribute('height') });
        d3.selectAll('#wire_vru, #sites_graph')
            .style('top', function () {
                var h3 = $(this).closest('section').find('.h3');
                return `${h3.get(0).offsetHeight}px`;
            });
        d3.select('#wire_vru')
            .style('z-index', 5);

        d3.selectAll('div.sites_gap')
            .style('height', function () {
                return `${window.innerHeight}px`;
            });

    } else {
        d3.select('#wire_vru svg')
            .attr('width', function () { return this.parentNode.offsetWidth })
            .attr('height', function() {
                return window.innerHeight - $(this).closest('section').find('.h3').get(0).offsetHeight;
            })
            .style('top', function () {
                var h3 = $(this).closest('section').find('.h3');
                return `${h3.get(0).offsetHeight}px`;
            });

        $('.sites_step, .topic_text')
            .css( 'min-height', window.innerHeight );
    }

    d3.selectAll('#sites_net_svg, #topic_viz canvas')
        .attr('width', function () { return this.parentNode.offsetWidth })
        .attr('height', function() {
            return window.innerHeight - $(this).closest('section').find('.h3').get(0).offsetHeight;
        });

    $('#wire_vru #spread_wire div.hline_day_feed, #spread_wire div#tline_text, #sites')
        .css( 'min-height', window.innerHeight );

    $('#show_map').css('min-height', window.innerHeight * 2);

    $('#sites_list, .sshot_text, .img_container, #topic_viz')
        .css('min-height', function () {
            var h3 = $(this).closest('section').find('.h3');
            return window.innerHeight - h3.get(0).offsetHeight;
        })
        .css('top', function () {
            var h3 = $(this).closest('section').find('.h3');
            return `${h3.get(0).offsetHeight}px`;
        });

    if (scroller == null) {} else { scroller.resize() }
};

// var stickyfill = Stickyfill();

// Timeline

var prev_step_progress;

Promise.all([d3.svg('img/tline_glyph.svg'), d3.csv('vru_wire.csv')])
    .then(function([glyph_path, data]) {
        glyph_path = $(glyph_path.documentElement).find('path').attr('d');

        data.forEach(function (d) {
            d.published = parseDateTime(d.published);
            d['day_sec'] = d.published.getHours() * 3600
                + d.published.getMinutes() * 60
                + d.published.getSeconds();
        });

        data = d3.nest()
            .key(function (d) { return date_str_fmt(d.published) })
            .entries(data);

        var tline_gs = svg_wire_vru.selectAll('g.day_g')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'day_g');

        var p_headline_divs = d3.select('#spread_wire')
            .selectAll('div.hline_day_feed')
            .data(data)
            .enter()
            .append('div')
            .attr('class', 'hline_day_feed');

        var p_headlines = p_headline_divs.selectAll('p')
            .data(function (d) { return d.values })
            .enter()
            .append('p')
            .attr('class', 'hline')
            .html(function (d) { return `
        <span>${print_date_fmt(d.published)} - <a href="${d.real_url}" target="_blank">${d.url_domain}</a></span><br>
        ${d.ra_title}
        `});

        p_headlines.selectAll('span')
            .style('color', function (d) {
                switch (this.parentNode.__data__.site_type) {
                    case 'vata': return vata_col;
                    case 'small_bad': return spin_col;
                    default: return chroma(neut_col).darken(0.8);
                }
            });

        p_headlines.on('mouseover', function (d) {
            var a = tline_articles
                .filter(function (t) { return d.real_url === t.real_url })
                .select('path');
            a.interrupt().transition(trans)
                .attr('transform', 'scale(3.5)')
                .duration(100)
        })
            .on('mouseout', function (d) {
                var a = tline_articles
                    .filter(function (t) { return d.real_url === t.real_url })
                    .select('path');
                a.interrupt().transition(trans)
                    .attr('transform',(window.innerWidth > 576) ? 'scale(2.5)' : 'scale(3.5)')
                    .duration(100)
            });

        var tline_days = tline_gs
            .append('circle')
            .attr('class', 'tline_day')
            .attr('r', function (d) {
                return pub2R(d.key)
            })
            .attr('cx', 0)
            .attr('cy', 0)
            .style('stroke-opacity', 0);

        var tline_labs = tline_gs.append('g')
            .attr('class', 'tline_lab')
            .style('fill-opacity', 0)
            .attr('transform', function (_, i) {
                if (i === 0) {
                    return 'translate(0 0)';
                } else {
                    var r = +d3.select(this.parentNode).select('circle.tline_day').attr('r');
                    return `translate(0 -${r + 5})`;
                }
            });

        var tline_lab_rects = tline_labs.append('rect')
            .attr('class', 'lab_rect')
            .style('fill', font_col);

        tline_labs.append('text')
            .text(function (d) { return d.key })
            .style('text-anchor', 'middle')
            .style('alignment-baseline', 'baseline')
            .style('font-size', (window.innerWidth > 576) ?'1.1em' : '1.5em');

        tline_lab_rects
            .datum(function (d) {
                var bbox = this.parentNode.getBBox();
                d['width'] = bbox.width + 10;
                d['height'] = bbox.height + 6;
                d['x'] = bbox.x - 5;
                d['y'] = bbox.y - 3;
                return d
            })
            .attr('x', function (d) { return d.x })
            .attr('y', function (d) { return d.y })
            .attr('height', function (d) { return d.height })
            .attr('width', function (d) { return d.width });

        var tline_articles = svg_wire_vru.selectAll('g.article')
            .data(data)
            .enter()
            .selectAll('g.article')
            .data(function (d) { return d.values; })
            .enter()
            .append('g')
            .classed('article', true)
            .classed('active', false)
            .style('fill', function (d) {
                switch (d.site_type) {
                    case 'vata': return vata_col;
                    case 'small_bad': return spin_col;
                    default: return neut_col;
                }
            })
            .style('stroke', function () { return $(this).attr('fill') })
            .style('stroke-opacity', 0)
            .style('opacity', 0);

        var tline_article_circles = tline_articles.append('path')
            .attr('class', 'article')
            .attr('d', glyph_path)
            .attr('transform', (window.innerWidth > 576) ? 'scale(2.5)' : 'scale(3.5)');

        var h3_h = $(p_headlines.node()).closest('section').find('.h3').height();

        tline_articles.attr('transform', function (d) {
            var bbox = this.getBBox();
            var el_angle = (tline_time_scale(d.day_sec) - 90) * Math.PI / 180;
            var r = pub2R(date_str_fmt(d.published));
            var x = r * Math.cos(el_angle);
            var y = r * Math.sin(el_angle);
            return `translate(${x - bbox.width/2} ${y - bbox.height/2})`;
        })
            .on('mouseover', function (d) {
                var p = p_headlines.filter(function(p) { return p.real_url === d.real_url} )
                    .node();
                if ( (p.getBoundingClientRect().bottom > h3_h && window.innerWidth > 576) ||
                     (p.getBoundingClientRect().top > svg_wire_vru.node().getBoundingClientRect().bottom && window.innerWidth <= 576)
                ) {
                    d3.select(p)
                        .classed('tooltiped', true)
                } else {
                    $(this).attr('data-tippy-content', p.outerHTML);
                }
            })
            .on('mouseleave', function () {
                $('p.hline.tooltiped').removeClass('tooltiped');
                $(this).removeAttr('data-tippy-content');
            });

        var min_published = d3.min(tline_articles.data(), function(d) {return d.published});
        var first_day_transition = trans.selection()
            .selectAll('#wire_vru g.day_g')
            .filter(function (d) { return d.key === date_str_fmt(min_published) });

        var first_article_trans = trans.selection()
            .selectAll('#wire_vru g.article')
            .filter(function (d) { return d.published === min_published });

        // Scrollama
        const tline_scroller = scrollama();
        fullscreen_fig(tline_scroller);

        tline_scroller
            .setup({
                step: '#spread_wire .hline_day_feed, #spread_wire p.hline, #spread_wire #tline_text',
                container: '#spread_wire',
                graphic: '#wire_vru',
                offset: (window.innerWidth > 576) ? 0.7 : 1,
                progress: true
            })
            .onStepEnter(function (r) {
                if (r.element.id === 'tline_text') { return }

                if (r.direction === 'down') {

                    if (r.element.tagName === 'DIV') {
                        var current_date = d3.select(r.element);
                        var step_day = trans.selection()
                            .selectAll('#wire_vru g.day_g')
                            .filter(function (d) { return (d.key === current_date.datum().key) && (+current_date.style('stroke-opacity') === 1) });
                        var day_trans = step_day.selectAll('circle.tline_day')
                            .transition()
                            .style('stroke-opacity', 1)
                            .duration(350);

                        var lab_trans = step_day.selectAll('g.tline_lab')
                            .transition()
                            .style('fill-opacity', 1)
                            .duration(350);

                    } else if (r.element.tagName === 'P') {
                        $(r.element).addClass('active');
                        var article_trans = trans.selection()
                            .selectAll('#wire_vru g.article')
                            .filter(function (d) { return d.real_url === d3.select(r.element).datum().real_url })
                            .classed('active', true)
                            .transition()
                            .style('opacity', 0.8)
                            .style('stroke-opacity', 1)
                            .duration(150)
                            .transition()
                            .duration(200);
                    }
                }
            })
            .onStepExit(function (r) {
                if (r.direction === 'up') {

                    if (r.element.tagName === 'DIV') {
                        var current_date = d3.select(r.element);
                        var step_day = trans.selection()
                            .selectAll('#wire_vru g.day_g')
                            .filter(function (d) {
                                return (d.key === current_date.datum().key)
                                    && (+current_date.style('stroke-opacity') === 1)
                                    && d.key !== first_day_transition.datum().key
                            });
                        var day_trans = step_day.selectAll('circle.tline_day')
                            .transition()
                            .style('stroke-opacity', 0)
                            .duration(350);

                        var lab_trans = step_day.selectAll('g.tline_lab')
                            .transition()
                            .style('fill-opacity', 0)
                            .duration(350);

                    } else if (r.element.tagName === 'P') {
                        $(r.element).removeClass('active');
                        var article_trans = trans.selection()
                            .selectAll('#wire_vru g.article')
                            .filter(function (d) {
                                return d.real_url === d3.select(r.element).datum().real_url
                                    && d.published !== first_article_trans.datum().published
                            })
                            .classed('active', false)
                            .transition()
                            .style('opacity', 0)
                            .style('stroke-opacity', 0)
                            .duration(150);
                    }
                }
            })
            .onContainerEnter(function (r) {
                $('.hline_day_feed').last().css('border-bottom', 'none');

                var min_published = d3.min(tline_articles.data(), function(d) {return d.published});
                var first_day_transition = trans.selection()
                    .selectAll('#wire_vru g.day_g')
                    .filter(function (d) { return d.key === date_str_fmt(min_published) })
                    .transition()
                    .style('stroke-opacity', 1)
                    .style('fill-opacity', 1)
                    .duration(300);

                var first_article_trans = trans.selection()
                    .selectAll('#wire_vru g.article')
                    .filter(function (d) { return d.published === min_published })
                    .transition()
                    .style('stroke-opacity', 1)
                    .style('opacity', 0.8)
                    .duration(300);
            });

        $(window).resize( function() { fullscreen_fig(tline_scroller) } );

        var tippy_tip;

        $(function () {
            tippy_tip = tippy(document.querySelectorAll('g.article'), {
                animation: 'fade',
                placement: 'top',
                onShow(tip) {
                    var content = tip.reference.getAttribute('data-tippy-content');
                    if (content) {
                        tip.setContent(content);
                    } else {
                        return false;
                    }
                }
            });
        });
    });

var change_sites_list = {
    'm_emo': 'emo_pers',
    'm_arg': 'arg_pers',
    'm_man': 'norm_pers'
};

var sites_headlines = {
    'm_emo': [
        'Емоційні маніпуляції',
        '<p>Колір та місце у рейтингу - % емоційно маніпулятивних новин. Довжина прямокутника - місячна кількість візитів, логарифмічна шкала з основою = 2</p>' +
        '<p>При гортанні тип рейтингу зміниться</p>'
    ],
    'm_arg': [
        'Маніпулювання аргументами',
        '<p>Рейтинг сайтів за часкою новин, що містять хибні аргументи</p>' +
        '<p>Колір та місце у рейтингу - % новин з маніпуляцією аргументами. Довжина прямокутника - місячна кількість візитів, логарифмічна шкала з основою = 2</p>'
    ],
    'm_man': [
        'Сумарний рейтинг маніпулятивності',
        '<p>За часткою новин, у яких зафіксували одну з маніпуляцій</p>' +
        '<p>Колір та місце у рейтингу - % новин, що містять маніпуляції. Довжина прямокутника - місячна кількість візитів, логарифмічна шкала з основою = 2</p>'
    ],
    'links_net': [
        'Посилання між сайтами',
        '<p>Кольорові лінії - на які джерела посилався сайт. Сірі зв\'язки - хто посилався на сайт, який ми не досліджували</p>'
    ],
    'about_ru': [
        'Роспропаганда',
        '<p>Місце в рейтингу маніпулятивності</p>'
    ]
};

// Screenshots

const sshot_scroller = scrollama();
fullscreen_fig(sshot_scroller);

sshot_scroller
    .setup({
        step: '.img_container img',
        container: '#screenshots',
        graphic: '.sshot_text',
        offset: 1
        // once: true
    })
    .onStepEnter(function (r) {
        $(r.element)
            .css('opacity', 1)
            .css('pointer-events', 'auto');

        $($('.sshot_text p').get(r.index))
            .css('opacity', 1);
    });

// Ranking

Promise.all([d3.csv('results201118.csv'), d3.text('site_links_targets.txt'), d3.csv('site_links_edges.csv')])
    .then(function ([data, target_only_nodes, site_links]) {
        data.forEach(function (d, i) {
            for (var pr in d) {
                if ( d[pr].search(/[^0-9\.]/) === -1 ) {
                    d[pr] = +d[pr];
                }
            }
            d.ukr_audience = (d.ukr_audience > 0) ? d.ukr_audience : 10000;
        });
        target_only_nodes = target_only_nodes.split('\n');
        site_links.forEach(function (d) {
            d.weight = +d.weight;
        });

        var site_divs = sites_list
            .style('height', function () { return $(this).css('min-height') })
            .selectAll('div.site')
            .data(data
                .sort(function (a, b) { return (a.emo_pers < b.emo_pers) ? 1 : -1 })
                .filter(function (d) { return d.norm_pers < 0.75 && ( d.site_type === 'small_bad' || d.site_type === 'vata' ) })
            )
            .enter()
            .append('div')
            .classed('site', true)
            .style('order', function (d, i) { return i+1 })
            .html(function (d) { return d.comment || d.url_domain });

        var target_only_sites = sites_list
            .selectAll('div.net_target')
            .data(target_only_nodes)
            .enter()
            .append('div')
            .classed('net_target', true)
            .style('opacity', '0')
            .style('pointer-events', 'none')
            .style('page-break-before', function (d, i) { if (i === 0) return 'always' })
            .style('order', function (d, i) { return site_divs.nodes().length + i + 1})
            .text(function (d) { return d });

        // var bar_w = calc_site_w(site_divs);
        // site_divs
        //     .style('width', `${bar_w}px`);

        var site_w = calc_site_w(site_divs);

        // target_only_sites
            // .style('display', 'none');      

        var scale_audience = d3.scaleLog()
            .base(2)
            .domain( d3.extent(site_divs.data(), function (d) { return d.ukr_audience }) )
            .range([5, site_w]);

        site_divs.text('');
        target_only_sites.text('');

        var site_svgs = site_divs.append('svg')
            .classed('site_bar', true)
            .attr('height', '1.1em')
            .attr('width', site_w)
            .style('overflow', 'visible');

        var target_svgs = target_only_sites.append('svg')
            .classed('net_target', true)
            .attr('height', '1.1em')
            .attr('width', site_w)
            .style('overflow', 'visible')
            .append('text')
            .attr('x', '0')
            .attr('y', '0.95em')
            // .style('font-size', '1em')
            .text(function (d) { return d });
        
        var site_bars = site_svgs.append('rect')
            .attr('height', '1.1em')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', function (d) { return scale_audience(d.ukr_audience) })
            .style('fill', function (d) { return man_scale(d.emo_pers) });

        var site_text = site_svgs.append('text')
            .attr('x', '0')
            .attr('y', '0.95em')
            // .style('font-size', '1em')
            .text(function (d) { return d.comment || d.url_domain });

        var link_lines = d3.select('svg#sites_net_svg')
            .selectAll('path')
            .data(site_links)
            .enter()
            .append('path');

        site_divs
            .attr('data-tippy-content', function (d) {
                return `<h6>${d.comment || d.url_domain}</h6>
                        <p>Візитів на місяць: ${d3.format(".2s")(d.ukr_audience)}</p>
                        <p>Новин, що маніпулюють емоціями: ${d3.format(".2%")(d.emo_pers)}</p>
                        `;
            });

        const sites_el_refs = {};
        site_divs.each(function (d) { sites_el_refs[d.url_domain] = this });
        target_only_sites.each(function (d) { sites_el_refs[d] = this });

        const scale_link_width = d3.scaleLinear()
            // .domain([d3.min(site_links, function (d) { return d.weight }) * 1.05, 1000])
            .domain([0.01, 0.25])
            .range([1.5, 7])
            .clamp(true);

        // Scrollama
        const sites_scroller = scrollama();
        fullscreen_fig(sites_scroller);

        var fs = $('div.site text').css('font-size').match(/([\d+])/)[0];

        sites_scroller
            .setup({
                step: '#sites .sites_step',
                container: '#sites',
                graphic: '#sites_graph',
                offset: (window.innerWidth > 576) ? 0.5 : 0,
                progress: true
            })
            .onContainerEnter()
            .onStepEnter(function (r) {
                var h3 = $(r.element).closest('section')
                    .css('opacity', 1)
                    .find('.h3 .col_block')
                    .html(`<h3>${sites_headlines[r.element.id][0]}</h3>${sites_headlines[r.element.id][1]}`);

                if (r.element.id === 'links_net') {
                    $('.net_target').css('opacity', 1).css('pointer-events', 'auto');
                    
                    $('#hower_me_net').css('opacity', 0.9).find('p');
                    window.setTimeout(
                        function () {
                            $('#hower_me_net').css('opacity', 0).slideUp()
                        }, 3000);
                    
                    $('#sites_list div.site, #sites_list div.net_target').addClass('link_listen');
                    $('.link_listen')
                        .on('mouseover mouseout', function (ev) {
                            if (r.element.id !== 'links_net') {
                                return
                            }
                            var site = this.__data__.url_domain || this.textContent;
                            var edges = link_lines.filter(function (d) {
                                return (target_only_nodes.indexOf(site) < 0)
                                    ? d.source === site
                                    : d.target === site;
                            })
                                .style('stroke', function (d) {
                                    return (target_only_nodes.indexOf(site) < 0)
                                        ? $(sites_el_refs[d.source]).find('rect').css('fill')
                                        : neut_col;
                                });

                            if (ev.type === 'mouseout') {
                                edges.interrupt()
                                    .transition()
                                    .style('opacity', 0)
                                    .duration(100);

                                d3.selectAll('text.big_text, text.half_big_text')
                                    .classed('big_text', false)
                                    .classed('half_big_text', false);

                            } else {
                                edges.filter(function () {
                                    return !$(this).attr('d')
                                })
                                    .style('opacity', 0)
                                    .style('stroke-width', function (d) {
                                        return scale_link_width(d.weight)
                                    })
                                    .attr('d', function (d) {
                                        var sn = sites_el_refs[d.source];
                                        var tn = sites_el_refs[d.target];
                                        sn = sn.getElementsByTagName('text')[0] || sn;
                                        tn = tn.getElementsByTagName('text')[0] || tn;
                                        var s_bcr = sn.getBoundingClientRect();
                                        var t_bcr = tn.getBoundingClientRect();
                                        var mx = this.parentNode.getBoundingClientRect().x;
                                        var my = this.parentNode.getBoundingClientRect().y;

                                        var x1 = s_bcr.x + s_bcr.width / 2,
                                            x2 = t_bcr.x,
                                            y1 = s_bcr.y + s_bcr.height / 2 - my + fs * 1.375 * 0.5,
                                            y2 = t_bcr.y + t_bcr.height / 2 - my + fs * 1.375 * 0.5;

                                        if (target_only_nodes.indexOf(d.target) < 0) {
                                            x2 += t_bcr.width / 2
                                        }
                                        return `M ${x1 - mx + 1} ${y1} l ${x2 - (x1 - 1)} ${y2 - y1}`;
                                    });

                                edges.interrupt()
                                    .transition(trans)
                                    .style('opacity', 0.65)
                                    .duration(500)
                                    .delay(50);

                                var involved_sites = [site];
                                edges.each(function (d) {
                                    if (involved_sites.indexOf(d.source) < 0) {
                                        involved_sites.push(d.source)
                                    }
                                    if (involved_sites.indexOf(d.target) < 0) {
                                        involved_sites.push(d.target)
                                    }
                                });

                                involved_sites.map(function (s, i) {
                                    s = sites_el_refs[s].getElementsByTagName('text')[0] || sites_el_refs[s];
                                    d3.select(s)
                                        .classed('big_text', i === 0)
                                        .classed('half_big_text', i > 0);
                                });
                            }
                        });
                } else if (r.element.id === 'about_ru') {
                    site_divs.filter(function (d) { return d.site_type === 'vata' })
                        .classed('highlight_ru', true);

                    site_divs.filter(function (d) { return d.site_type !== 'vata' })
                        .classed('hide_non_ru', true);

                } else {
                    var field = change_sites_list[r.element.id];
                    site_divs
                        .sort(function (a, b) {
                            if (field === 'norm_pers') {
                                return (a[field] > b[field]) ? 1 : -1;
                            } else {
                                return (a[field] < b[field]) ? 1 : -1;
                            }
                        })
                        .style('order', function (d, i) { return i + 1 })
                        .attr('data-tippy-content', function (d) {
                            var name_man;
                            if (field === 'emo_pers') {
                                name_man = 'Новин, що маніпулюють емоціями';
                            } else if (field === 'arg_pers') {
                                name_man = 'Новин, що маніпулюють аргументами';
                            } else {
                                name_man = 'Новин, що містять маніпуляції';
                            }
                            return `<h6>${d.comment || d.url_domain}</h6>
                            <p>Візитів на місяць: ${d3.format(".2s")(d.ukr_audience)}</p>
                            <p>${name_man}: ${d3.format(".2%")((field === 'norm_pers') ? 1 - d[field] : d[field])}</p>`;
                        })
                        .selectAll('rect')
                        .interrupt()
                        .transition(trans)
                        .style('fill', function (d) {
                            return (field === 'norm_pers') ? man_scale(1 - d[field]) : man_scale(d[field])
                        })
                        .duration(2000);
                }
            })
            .onStepExit(
                function (r) {
                    if (r.element.id === 'links_net') {
                        $('.net_target').css('opacity', 0).css('pointer-events', 'none');
                        $('.link_listen').off().removeClass('link_listen');
                        link_lines.style('opacity', 0);
                        $('#hower_me_net').css('opacity', 0);
                        $('.big_text, .half_big_text')
                            .removeClass('half_big_text')
                            .removeClass('big_text');
                    } else if (r.element.id === 'about_ru') {
                        var vata_sites = site_divs.filter(function (d) { return d.site_type === 'vata' })
                            .classed('highlight_ru', false);

                        site_divs.filter(function (d) { return d.site_type !== 'vata' })
                            .classed('hide_non_ru', false);
                    }
                })
            .onStepProgress(function (r) {
                if (r.element.id === 'about_ru' && r.progress > prev_step_progress && r.progress > 0.85) {
                    $(r.element).closest('section').find('.h3')
                        .css('opacity', 0)
                        .css('pointer-events', 'none');
                    prev_step_progress = null;
                } else if (r.element.id === 'about_ru' && r.progress < prev_step_progress && r.progress > 0.85) {
                    $(r.element).closest('section').find('.h3')
                        .css('opacity', 1)
                        .css('pointer-events', 'auto');
                    prev_step_progress = null;
                }
                prev_step_progress = r.progress;
            });

        var tippy_tip;

        $(function () {
            tippy_tip = tippy(document.querySelectorAll('div.site'), {
                animation: 'fade',
                placement: 'top',
                onShow(tip) {
                    tip.setContent(tip.reference.getAttribute('data-tippy-content'))
                }
            });
        });
    });

$(window).resize( function() { fullscreen_fig() } );

var calc_site_w = function () {
    var $divs = $('#sites_list div.site, #sites_list div.net_target');
    var cont_w = $divs.closest('#sites_list').width();
    var ws = [];
    var current_fs = +$divs.css('font-size').replace(/[^0-9\.]+/, '');
    $divs.each( function() {
        ws.push( $(this).width() );
    });
    const n_sites = ws.length;
    ws = d3.max(ws);
    var end_pos = $divs.last().position().left + ws;
    var i = 0;
    while ( cont_w < end_pos && i < 25 ) {
        current_fs -= 1;

        $divs.parent()
            .css('font-size', `${current_fs}px`);
        ws = [];
        $divs.each( function() {
            ws.push( $(this).width() );
        });
        ws = d3.max(ws);
        end_pos = $divs.last().position().left + ws;
        i++;
    }
    return ws - +$('#sites_list div.site').css('padding-left').match(/[0-9\.]+/)[0] * 2;
};

// --- Topic map ------------------------------------------------------------------------------------------------------

// Global variables
var label_array = [],
    width = +canvas.attr('width'),
    height = +canvas.attr('height');
const nrows = 3;
const font_size_s = 11;
const font_size_b = 28;
const main_font = "droid-mono";
const second_font = "Yanone Kaffeesatz";
const between_lines_interval = 0.1;
// real colors
const color_codes = ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02'];
const colors = {};
// some technical ids, not colors
const class_names = ["#a03532",          "#c1498c", "#4623a3", "#643c5a",     "#3a87cd",           "#05b66d"];
//const class_names = ["Влада/політики", "Війна",   "Росія",   "Про Україну", "Новини з соцмереж", "Церква"];
class_names.map(function(d, i){ colors[d] = color_codes[i] });
var context;
var k = (window.innerWidth > 576) ? 1 : 0.8;  // current zoom level

// function to redraw on each "zoom" event
function zoomed(){
    context.save();
    context.clearRect(0, 0, width, height);
    context.translate(d3.event.transform.x, d3.event.transform.y);
    context.scale(d3.event.transform.k, d3.event.transform.k);
    k = d3.event.transform.k;
    drawLabels(k);
    context.restore();
}
// workhorse: to draw titles of news and names of topics
function drawLabels(k){
    var font_size;
    context.clearRect(0, 0, width, height);

    for (var i = 0; i < label_array.length; i++) {
        context.fillStyle = colors[label_array[i].color];
        if(label_array[i].level < 3){ // in case of topic names
            font_size = font_size_b;
            font_size = font_size - 10*(label_array[i].level - 1);
            context.font = `${font_size}px "${main_font}"`;
            context.fillText(label_array[i].name, label_array[i].x, label_array[i].y - 0.8*font_size);
        } else {  //news items
            font_size =  Math.floor(Math.sqrt( (font_size_s * k) ));
            context.font = `${font_size}px "${second_font}"`;
            var boo = label_array[i];
            for(var j = 0; j < boo.rows.length; j++){
                var row = boo.rows[j].join(' ');
                if( j == nrows-1 ){  // add ... in case we've trimmed name
                    // TODO:  change it in data preparation script
                    row += ' ...';
                }
                context.fillText(row, boo.x, boo.y - boo.height + j * font_size * (1+between_lines_interval));
            }
            // ... and add site name
            context.font = `${font_size}px "${second_font}"`;
            context.fillStyle = 'gray';
            context.fillText(boo.url, boo.x, boo.y - boo.height + j * font_size * (1 + between_lines_interval));
        }
    }
}

var zoom = d3.zoom()
    .scaleExtent([0.5, 4])
    .on("zoom", zoomed);

// starting point - center of canvas
var point = {x: width / 2, y: height / 2 };

function transform() {
    return d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(k)
        .translate(-point.x - correction, -point.y); // center topic name on screen
}

// parameters of transition
function transition(canvas) {
    canvas.transition()
        .delay(10)
        .duration(1500)
        .call(zoom.transform, transform)
}
var correction = 0;
var points = { 
    'poroshenko': 730,
    'saakashvili': 728,
    'ukraine': 741
};

// Main logic
d3.json("./labels.json").then(function(data) {
    label_array = data;
    context = canvas.node().getContext("2d");
    // initial screen with scale (k) == 1
    canvas
        .call(zoom.transform, transform);
    canvas
        .call(transition);

    const tmap_scroller = scrollama();
    fullscreen_fig(tmap_scroller);
    tmap_scroller
        .setup({
            step: '.topic_text',
            container: '#spread_wire',
            graphic: '#topic_map',
            offset: 0.1,
            progress: true
        })
        .onStepEnter(function (r) {
            if ( points[r.element.id] ) {
                point = label_array[points[r.element.id]];
                correction = point.width / 3;
                k = (window.innerWidth > 576) ? 3 : 2;  // new scale
                canvas
                    .call(transition);

            } else if (r.element.id === 'topic_intro') {
                point = {x: width / 2, y: height / 2 };
                k = (window.innerWidth > 576) ? 1 : 0.9;
                canvas
                    .call(transition);
            } else if (r.element.id === 'show_map') {
                point = {x: width / 2, y: height / 2 };
                k = (window.innerWidth > 576) ? 1 : 0.9;

                canvas
                    .call(zoom)
                    .call(transition);

                $('#topic_map canvas').css('cursor', 'grabbing');
                $('#topic_tip, #topic_tip *').css('opacity', 1);
                $('#topic_tip nav i').css('pointer-events', 'auto');
                window.setTimeout(
                    function () {
                        $('#topic_tip p').css('opacity', 0).slideUp()
                    }, 3000);
                if (r.direction === 'up') {
                    window.scrollTo({
                        top: document.getElementById('show_map').offsetTop,
                        behavior: "smooth"
                    });
                }
            }
        })
        .onStepExit(function (r) {
            if (r.element.id === 'show_map') {
                canvas.on(".zoom", null);
                $('#topic_tip, #topic_tip *').css('opacity', 0);
                $('#topic_tip nav i').css('pointer-events', 'none');
                $('#topic_map canvas').css('cursor', 'auto');
            }
        })
});

$( document ).ready( function() {
    $('#topic_tip nav i').click(function () {
        var to_el = ( this.classList.contains('fa-angle-up') )
            ? document.getElementById('saakashvili')
            : $(this).closest('section').next('*').get(0);

        window.scrollTo({
            top: to_el.offsetTop,
            behavior: "smooth"
        });
    });

    $('#screenshots')
        .find('img')
        .mouseover(function () {
            $(this)
                .parent()
                .css('background-color', 'transparent')
                .css('z-index', 7);
        })
        .mouseout(function () {
            $(this)
                .parent()
                .css('background-color', '')
                .css('z-index', 6);
        });
});
