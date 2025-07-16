// christopher pietsch
// @chrispiecom
// 2015-2018

utils.welcome();

var data;
var tags;
var canvas;
var search;
var ping;
var timeline;
var map;

// Die WebGL- und Mobile-Prüfung wurde entfernt, um die Initialisierung zu erzwingen.
init();

function init() {
  // Für PIXI.js 5.x muss der Parser anders registriert werden
  if (typeof PIXI !== 'undefined' && PIXI.Loader) {
    // Überprüfe die PIXI-Version
    console.log('PIXI Version:', PIXI.VERSION);
    
    // Für PIXI 5.x verwende Loader.shared.use() statt registerPlugin
    if (PIXI.Loader.shared) {
      PIXI.Loader.shared.use(pixiPackerParser(PIXI));
      console.log('pixi-packer-parser mit Loader.shared.use() registriert');
    } else {
      console.log('Versuche registerPlugin...');
      PIXI.Loader.registerPlugin(pixiPackerParser(PIXI));
    }
  } else {
    console.error('PIXI oder PIXI.Loader ist nicht verfügbar!');
  }
  
  canvas = Canvas();
  search = Search();
  timeline = Timeline();
  map = Mapbox();
  ping = utils.ping();

  var baseUrl = utils.getDataBaseUrl();
  var makeUrl = utils.makeUrl;

  d3.json("data/config.json", function (error, config) {
    if (error) {
        console.error("FEHLER: Die Datei 'data/config.json' konnte nicht geladen werden.");
        console.error("Bitte prüfe, ob der Pfad und Dateiname korrekt sind und du einen Webserver verwendest.");
        console.error("Technische Details:", error);
        return; 
    }

    config.baseUrl = baseUrl;
    utils.initConfig(config);

    Loader(makeUrl(baseUrl.path, config.loader.timeline)).finished(function (timeline) {
      Loader(makeUrl(baseUrl.path, config.loader.items)).finished(function (data) {
        
        utils.clean(data, config.delimiter);
        
        if(config.filter && config.filter.type === "crossfilter") {
          tags = Crossfilter();
        } else {
          tags = Tags();
        }
        tags.init(data, config);
        search.init();
        canvas.init(data, timeline, config);
        map.init(data); 

        if (config.loader.layouts) {
          initLayouts(config);
        } else {
          canvas.setMode({
            title: "Time",
            type: "group",
            groupKey: "year"
          })
        }

        // Verwende PIXI.Loader.shared statt new PIXI.Loader()
        PIXI.Loader.shared.add("spritesheet", makeUrl(baseUrl.path, config.loader.textures.medium.url));
        
        PIXI.Loader.shared.load(function(loader, resources) {
          console.log('PIXI Loader finished. Resources:', Object.keys(resources));
          
          // Detaillierte Analyse der geladenen Ressource
          if (resources.spritesheet) {
            console.log('Spritesheet resource:', resources.spritesheet);
            console.log('Spritesheet children:', resources.spritesheet.children);
            
            // Bei pixi-packer-parser werden die Texturen in den child resources erstellt
            let allTextures = {};
            
            // Prüfe die child resources nach Texturen
            resources.spritesheet.children.forEach(child => {
              if (child.textures) {
                console.log(`Texturen in child ${child.name}:`, Object.keys(child.textures));
                Object.assign(allTextures, child.textures);
              }
            });
            
            if (Object.keys(allTextures).length > 0) {
              console.log('Alle verfügbaren Texturen:', Object.keys(allTextures));
              
              // Erstelle eine Map für schnelleren Zugriff
              const dataMap = new Map(
                data
                  .filter(d => d.sprite)
                  .map(d => [d.id, d])
              );
              
              // Weise die Texturen den Sprites zu
              Object.keys(allTextures).forEach(id => {
                const item = dataMap.get(id);
                if (item && item.sprite) {
                  item.sprite.texture = allTextures[id];
                  console.log(`Texture assigned to sprite: ${id}`);
                }
              });
              
              canvas.wakeup();
            } else {
              console.error('Keine Texturen in den child resources gefunden!');
              console.log('Verfügbare child resources:', resources.spritesheet.children.map(c => c.name));
            }
          } else {
            console.error('Spritesheet-Ressource nicht gefunden!');
          }
        });
        
        // Fehlerbehandlung hinzufügen
        PIXI.Loader.shared.onError.add(function(error) {
          console.error('PIXI Loader Error:', error);
        });
      });
    });
  });

  d3.select(window)
    .on("resize", function () {
      if (canvas !== undefined && tags !== undefined) {
        clearTimeout(window.resizedFinished);
        window.resizedFinished = setTimeout(function () {
          canvas.resize();
          tags.resize();
        }, 250);
      }
    })
    .on("keydown", function (e) {
      if (d3.event.keyCode != 27) return;
      search.reset();
      tags.reset();
      canvas.split();
    });

  d3.select(".filterReset").on("click", function () {
    canvas.resetZoom(function () {
      tags.reset();
    })
  });
  d3.select(".filterReset").on("dblclick", function () {
    location.reload();
  });

  d3.select(".slidebutton").on("click", function () {
    var s = !d3.select(".sidebar").classed("sneak");
    d3.select(".sidebar").classed("sneak", s);
  });

  d3.select(".infobutton").on("click", function () {
    var s = !d3.select(".infobar").classed("sneak");
    d3.select(".infobar").classed("sneak", s);
  });

  function initLayouts(config) {
    d3.select(".navi").classed("hide", false);

    config.loader.layouts.forEach((d, i) => {
      if (!d.type && !d.url) {
        d.type = "group"
        d.groupKey = "year"
      }
      if (d.type === "group" && i == 0) {
        canvas.setMode(d);
      } else if (d.url) {
        d3.csv(utils.makeUrl(baseUrl.path, d.url), function (tsne) {
          canvas.addTsneData(d.title, tsne, d.scale);
          if (i == 0) canvas.setMode(d);
        });
      }
    });

    if (config.loader.layouts.length == 1) {
      d3.select(".navi").classed("hide", true);
    }

    var s = d3.select(".navi").selectAll(".button").data(config.loader.layouts);
    s.enter()
      .append("div")
      .classed("button", true)
      .classed("space", (d) => d.space)
      .text((d) => d.title);

    s.on("click", function (d) {
      if (!d || !d.title) {
        console.error("Layout-Objekt in config.json ist fehlerhaft:", d);
        return;
      }
      canvas.setMode(d);
      var isMapMode = d.title.toLowerCase() === 'karte';
      d3.select("#map").classed("hide", !isMapMode);
      timeline.setDisabled(isMapMode);
      d3.selectAll(".navi .button").classed(
        "active",
        (navItem) => navItem.title === canvas.getMode().title
      );
    });
    
    d3.selectAll(".navi .button").classed(
      "active",
      (d) => d.title == config.loader.layouts[0].title
    );
  }
}

d3.select(".browserInfo").classed("show", utils.isMobile());
