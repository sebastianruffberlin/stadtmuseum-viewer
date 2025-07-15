// christopher pietsch
// cpietsch@gmail.com
// 2015-2018

function Canvas() {
  var margin = {
    top: 20,
    right: 50,
    bottom: 50,
    left: 50,
  };

  var minHeight = 400;
  var width = window.innerWidth - margin.left - margin.right;
  var widthOuter = window.innerWidth;
  
  // *** MODIFICATION START ***
  // Die Höhe wird jetzt in canvas.init() und canvas.resize() berechnet,
  // da wir erst dort sicher auf die Höhe des Headers zugreifen können.
  var height;
  // *** MODIFICATION END ***

  var scale;
  var scale1 = 1;
  var scale2 = 1;
  var scale3 = 1;
  var allData = [];

  var translate = [0, 0];
  var scale = 1;
  var timeDomain = [];
  var canvasDomain = [];
  var loadImagesCue = [];

  var resolution = 1; // window.devicePixelRatio || 1;

  var x = d3.scale
    .ordinal()
    .rangeBands([margin.left, width + margin.left], 0.2);

  var yscale = d3.scale.linear()

  var Quadtree = d3.geom
    .quadtree()
    .x(function (d) {
      return d.x;
    })
    .y(function (d) {
      return d.y;
    });

  var quadtree;

  var maxZoomLevel = utils.isMobile() ? 5000 : 2500;

  var zoom = d3.behavior
    .zoom()
    .scaleExtent([1, maxZoomLevel])
    // Die Größe wird in canvas.resize() korrekt gesetzt
    .on("zoom", zoomed)
    .on("zoomend", zoomend)
    .on("zoomstart", zoomstart);

  var canvas;
  var config;
  var container;
  var entries;
  var years;
  var data;
  var rangeBand = 0;
  var rangeBandImage = 0;
  var imageSize = 256;
  var imageSize2 = 1024;
  var imageSize3 = 4000;
  var columns = 4;
  var renderer, stage;

  var svgscale, voronoi;

  var selectedImageDistance = 0;
  var selectedImage = null;

  var drag = false;
  var sleep = false;

  var stagePadding = 40;
  var imgPadding;

  var bottomPadding = 70;
  var extent = [0, 0];
  var bottomZooming = false;

  var touchstart = 0;
  var vizContainer;
  var spriteClick = false;

  var state = {
    lastZoomed: 0,
    zoomingToImage: false,
    init: false,
    mode: "time",
  };

  var zoomedToImage = false;
  var zoomedToImageScale = 117;
  var zoomBarrier = 2;

  var startTranslate = [0, 0];
  var startScale = 0;
  var cursorCutoff = 1;
  var zooming = false;
  var detailContainer = d3.select(".sidebar");
  var timelineData;
  var stage, stage1, stage2, stage3, stage4, stage5;
  var timelineHover = false;
  var tsneIndex = {};
  var tsneScale = {}

  function canvas() { }

  canvas.margin = margin;

  canvas.rangeBand = function () {
    return rangeBand;
  };
  canvas.width = function () {
    return width;
  };
  canvas.height = function () {
    return height;
  };
  canvas.rangeBandImage = function () {
    return rangeBandImage;
  };
  canvas.zoom = zoom;
  canvas.selectedImage = function () {
    return selectedImage;
  };
  canvas.x = x;
  canvas.y = yscale;

  // *** MODIFICATION START ***
  // Die resize-Funktion wird angepasst, um die Header-Höhe zu berücksichtigen.
  canvas.resize = function () {
    if (!state.init) return;

    // Header-Höhe bei jeder Größenänderung neu berechnen.
    const topContainer = document.getElementById('top-container');
    const topContainerHeight = topContainer ? topContainer.offsetHeight : 0;
    
    width = window.innerWidth - margin.left - margin.right;
    // Höhe des Fensters abzüglich der Header-Höhe.
    height = (window.innerHeight < minHeight ? minHeight : window.innerHeight) - topContainerHeight;
    widthOuter = window.innerWidth;
    
    // Dem Renderer die korrekte, neue Größe mitteilen.
    renderer.resize(width + margin.left + margin.right, height);
    
    // Die Zoom-Verhalten an die neue Größe anpassen.
    zoom.size([width, height]);
    
    canvas.makeScales();
    canvas.project();
  };
  // *** MODIFICATION END ***


  canvas.makeScales = function () {
    x.rangeBands([margin.left, width + margin.left], 0.2);

    rangeBand = x.rangeBand();
    rangeBandImage = x.rangeBand() / columns;

    imgPadding = rangeBand / columns / 2;

    scale1 = imageSize / rangeBandImage;
    scale2 = imageSize2 / rangeBandImage;
    scale3 = imageSize3 / rangeBandImage;

    stage3.scale.x = 1 / scale1;
    stage3.scale.y = 1 / scale1;
    stage3.y = height;

    stage4.scale.x = 1 / scale2;
    stage4.scale.y = 1 / scale2;
    stage4.y = height;

    stage5.scale.x = 1 / scale3;
    stage5.scale.y = 1 / scale3;
    stage5.y = height;

    timeline.rescale(scale1);

    cursorCutoff = (1 / scale1) * imageSize * 0.48;
    zoomedToImageScale =
      (0.8 / (x.rangeBand() / columns / width)) *
      (state.mode.type === "group" ? 1 : 0.5);
  };

  canvas.initGroupLayout = function () {
    var groupKey = state.mode.groupKey
    console.log("initGroupLayout", groupKey);
    canvasDomain = d3
      .nest()
      .key(function (d) {
        return d[groupKey];
      })
      .entries(data.concat(timelineData))
      .sort(function (a, b) {
        return a.key - b.key;
      })
      .map(function (d) {
        return d.key;
      });

    timeDomain = canvasDomain.map(function (d) {
      return {
        key: d,
        values: timelineData
          .filter(function (e) {
            return d == e[groupKey];
          }).map(function (e) {
            e.type = "timeline";
            return e;
          })
      };
    });
    console.log("canvasDomain", canvasDomain);
    console.log("timeDomain", timeDomain);


    timeline.init(timeDomain);

    x.domain(canvasDomain);

  };

  // *** MODIFICATION START ***
  // canvas.init wird angepasst, um die initiale Größe und Position korrekt zu setzen.
  canvas.init = function (_data, _timeline, _config) {
    data = _data;
    config = _config;
    timelineData = _timeline;

    // 1. Header-Höhe ermitteln
    const topContainer = document.getElementById('top-container');
    const topContainerHeight = topContainer ? topContainer.offsetHeight : 0;
    
    // 2. Die globale 'height'-Variable korrekt initialisieren
    height = (window.innerHeight < minHeight ? minHeight : window.innerHeight) - topContainerHeight;
    zoom.size([width, height]); // Zoom initial anpassen

    // 3. Den .viz-Container erstellen und positionieren
    container = d3.select(".page").append("div").classed("viz", true);
    container.style("position", "absolute");
    container.style("top", topContainerHeight + "px");

    // *** MODIFICATION END ***

    detailVue._data.structure = config.detail.structure;

    columns = config.projection.columns;
    imageSize = config.loader.textures.medium.size;
    imageSize2 = config.loader.textures.detail.size;

    if (config.loader.textures.big) {
      imageSize3 = config.loader.textures.big.size;
    }

    var renderOptions = {
      resolution: resolution,
      antialiasing: true,
      width: width + margin.left + margin.right,
      height: height, // <-- Nutzt jetzt die korrigierte Höhe
    };
    renderer = new PIXI.Renderer(renderOptions);
    renderer.backgroundColor = parseInt(
      config.style.canvasBackground.substring(1),
      16
    );
    window.renderer = renderer;

    var renderElem = d3.select(container.node().appendChild(renderer.view));

    stage = new PIXI.Container();
    stage2 = new PIXI.Container();
    stage3 = new PIXI.Container();
    stage4 = new PIXI.Container();
    stage5 = new PIXI.Container();

    stage.addChild(stage2);
    stage2.addChild(stage3);
    stage2.addChild(stage4);
    stage2.addChild(stage5);

    canvas.initGroupLayout();

    data.forEach(function (d, i) {
      var sprite = new PIXI.Sprite(PIXI.Texture.WHITE);

      sprite.anchor.x = 0.5;
      sprite.anchor.y = 0.5;

      sprite.scale.x = d.scaleFactor;
      sprite.scale.y = d.scaleFactor;

      sprite._data = d;
      d.sprite = sprite;

      stage3.addChild(sprite);
    });

    var lastClick = 0;

    vizContainer = d3
      .select(".viz")
      .call(zoom)
      .on("mousemove", mousemove)
      .on("dblclick.zoom", null)
      .on("dblclick", null)
      .on("touchstart", function (d) {
        mousemove(d);
        touchstart = new Date() * 1;
      })
      .on("click", function () {

        var clicktime = new Date() * 1 - lastClick;
        if (clicktime < 250) return;
        lastClick = new Date() * 1;

        console.log("click");
        if (spriteClick) {
          spriteClick = false;
          return;
        }

        if (selectedImage && !selectedImage.id) return;
        if (drag) return;
        if (selectedImageDistance > cursorCutoff) return;
        if (selectedImage && !selectedImage.active) return;
        if (timelineHover) return;

        if (Math.abs(zoomedToImageScale - scale) < 0.1) {
          canvas.resetZoom();
        } else {
          zoomToImage(selectedImage, 1400 / Math.sqrt(Math.sqrt(scale)));
        }
      });

    vizContainer.on("contextmenu", function () {
      d3.event.preventDefault();
    });

    animate();
    state.init = true;
  };
  
  // (Der Rest der Datei bleibt unverändert)
  // ... (fügen Sie hier den Rest Ihres Codes ein, ab canvas.addTsneData) ...
  
  // Kopieren Sie einfach den gesamten Rest Ihrer Datei ab hier.
  // Ich lasse ihn hier weg, um die Antwort kurz zu halten.
  // Wichtig ist nur, dass die Funktionen "canvas.init" und "canvas.resize"
  // ersetzt werden und die "height"-Variable am Anfang nur deklariert wird.

  // ... [REST OF YOUR CODE] ...
  
  return canvas;
}
