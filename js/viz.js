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
  console.log('🚀 INIT START');
  
  // Für PIXI.js 5.x muss der Parser anders registriert werden
  if (typeof PIXI !== 'undefined' && PIXI.Loader) {
    console.log('✅ PIXI verfügbar, Version:', PIXI.VERSION);
    
    // Für PIXI 5.x verwende Loader.shared.use() statt registerPlugin
    if (PIXI.Loader.shared) {
      PIXI.Loader.shared.use(pixiPackerParser(PIXI));
      console.log('✅ pixi-packer-parser mit Loader.shared.use() registriert');
    } else {
      console.log('⚠️ Fallback: Versuche registerPlugin...');
      PIXI.Loader.registerPlugin(pixiPackerParser(PIXI));
    }
  } else {
    console.error('❌ PIXI oder PIXI.Loader ist nicht verfügbar!');
  }
  
  canvas = Canvas();
  search = Search();
  timeline = Timeline();
  map = Mapbox();
  ping = utils.ping();
  
  console.log('✅ Komponenten initialisiert');

  var baseUrl = utils.getDataBaseUrl();
  var makeUrl = utils.makeUrl;
  
  console.log('🔗 Base URL:', baseUrl);

  d3.json("data/config.json", function (error, config) {
    if (error) {
        console.error("❌ FEHLER: Die Datei 'data/config.json' konnte nicht geladen werden.");
        console.error("Bitte prüfe, ob der Pfad und Dateiname korrekt sind und du einen Webserver verwendest.");
        console.error("Technische Details:", error);
        return; 
    }
    
    console.log('✅ Config geladen:', config);

    config.baseUrl = baseUrl;
    utils.initConfig(config);

    Loader(makeUrl(baseUrl.path, config.loader.timeline)).finished(function (timelineData) {
      console.log('✅ Timeline geladen:', timelineData.length, 'Einträge');
      
      Loader(makeUrl(baseUrl.path, config.loader.items)).finished(function (itemData) {
        console.log('✅ Items geladen:', itemData.length, 'Einträge');
        
        data = itemData; // Setze globale data Variable
        
        utils.clean(data, config.delimiter);
        console.log('✅ Data cleaned');
        
        if(config.filter && config.filter.type === "crossfilter") {
          tags = Crossfilter();
        } else {
          tags = Tags();
        }
        tags.init(data, config);
        console.log('✅ Tags initialisiert');
        
        search.init();
        console.log('✅ Search initialisiert');
        
        canvas.init(data, timelineData, config);
        console.log('✅ Canvas initialisiert');
        
        map.init(data);
        console.log('✅ Map initialisiert');

        if (config.loader.layouts) {
          initLayouts(config);
        } else {
          canvas.setMode({
            title: "Time",
            type: "group",
            groupKey: "year"
          });
        }
        console.log('✅ Layouts initialisiert');

        // DEBUG: Prüfe data vor Sprite-Loading
        console.log('🔍 DATA DEBUG vor Sprite-Loading:');
        console.log('  Total items:', data.length);
        console.log('  Items with sprite:', data.filter(d => d.sprite).length);
        console.log('  Active items:', data.filter(d => d.active).length);
        console.log('  First 3 items:', data.slice(0, 3));

        // SPRITE LOADING
        const spritesheetUrl = makeUrl(baseUrl.path, config.loader.textures.medium.url);
        console.log('🖼️ Loading spritesheet from:', spritesheetUrl);
        
        // Verwende PIXI.Loader.shared statt new PIXI.Loader()
        PIXI.Loader.shared.add("spritesheet", spritesheetUrl);
        
        PIXI.Loader.shared.load(function(loader, resources) {
          console.log('🎯 PIXI Loader finished. Resources:', Object.keys(resources));
          
          // Detaillierte Analyse der geladenen Ressource
          if (resources.spritesheet) {
            console.log('📊 Spritesheet resource analysis:');
            console.log('  Name:', resources.spritesheet.name);
            console.log('  URL:', resources.spritesheet.url);
            console.log('  Data:', resources.spritesheet.data);
            console.log('  Children count:', resources.spritesheet.children?.length || 0);
            console.log('  Children:', resources.spritesheet.children?.map(c => c.name) || []);
            
            // Bei pixi-packer-parser werden die Texturen in den child resources erstellt
            let allTextures = {};
            
            // Prüfe die child resources nach Texturen
            if (resources.spritesheet.children) {
              resources.spritesheet.children.forEach(child => {
                console.log(`📝 Child resource: ${child.name}`);
                console.log('  Has textures:', !!child.textures);
                if (child.textures) {
                  console.log('  Texture count:', Object.keys(child.textures).length);
                  console.log('  Texture names:', Object.keys(child.textures).slice(0, 10));
                  Object.assign(allTextures, child.textures);
                }
              });
            }
            
            // Prüfe auch TextureCache
            const cacheTextures = Object.keys(PIXI.utils.TextureCache);
            console.log('🗂️ TextureCache entries:', cacheTextures.length);
            console.log('  Sample cache entries:', cacheTextures.slice(0, 10));
            
            // Verwende TextureCache falls child resources leer sind
            if (Object.keys(allTextures).length === 0) {
              console.log('⚠️ Keine Texturen in child resources, verwende TextureCache');
              cacheTextures.forEach(id => {
                if (PIXI.utils.TextureCache[id] && PIXI.utils.TextureCache[id] !== PIXI.Texture.WHITE) {
                  allTextures[id] = PIXI.utils.TextureCache[id];
                }
              });
            }
            
            console.log('🎨 Total textures found:', Object.keys(allTextures).length);
            
            if (Object.keys(allTextures).length > 0) {
              console.log('✅ Assigning textures to sprites...');
              
              // Erstelle eine Map für schnelleren Zugriff
              const dataMap = new Map(
                data
                  .filter(d => d.sprite)
                  .map(d => [d.id, d])
              );
              
              console.log('📊 Data map created with', dataMap.size, 'entries');
              
              let assignedCount = 0;
              let skippedCount = 0;
              
              // Weise die Texturen den Sprites zu
              Object.keys(allTextures).forEach(id => {
                const item = dataMap.get(id);
                if (item && item.sprite) {
                  item.sprite.texture = allTextures[id];
                  assignedCount++;
                  if (assignedCount <= 5) {
                    console.log(`✅ Texture assigned to sprite: ${id}`);
                  }
                } else {
                  skippedCount++;
                  if (skippedCount <= 5) {
                    console.log(`⚠️ Texture ${id} skipped - no matching sprite`);
                  }
                }
              });
              
              console.log(`📈 TEXTURE ASSIGNMENT COMPLETE:`);
              console.log(`  Assigned: ${assignedCount}`);
              console.log(`  Skipped: ${skippedCount}`);
              console.log(`  Total textures: ${Object.keys(allTextures).length}`);
              
              // SPRITE DEBUGGING
              setTimeout(() => {
                debugSprites();
                forceInitialVisibility();
              }, 100);
              
              canvas.wakeup();
            } else {
              console.error('❌ Keine Texturen gefunden!');
            }
          } else {
            console.error('❌ Spritesheet-Ressource nicht gefunden!');
          }
        });
        
        // Fehlerbehandlung hinzufügen
        PIXI.Loader.shared.onError.add(function(error) {
          console.error('❌ PIXI Loader Error:', error);
        });
      });
    });
  });

  d3.select(window)
    .on("resize", function () {
      console.log('📐 Window resized');
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
      console.log('⌨️ ESC pressed - resetting');
      search.reset();
      tags.reset();
      canvas.split();
    });

  d3.select(".filterReset").on("click", function () {
    console.log('🔄 Filter reset clicked');
    canvas.resetZoom(function () {
      tags.reset();
    });
  });
  
  d3.select(".filterReset").on("dblclick", function () {
    console.log('🔄 Filter reset double-clicked - reloading');
    location.reload();
  });

  d3.select(".slidebutton").on("click", function () {
    var s = !d3.select(".sidebar").classed("sneak");
    d3.select(".sidebar").classed("sneak", s);
    console.log('📱 Sidebar toggled:', s ? 'hidden' : 'visible');
  });

  d3.select(".infobutton").on("click", function () {
    var s = !d3.select(".infobar").classed("sneak");
    d3.select(".infobar").classed("sneak", s);
    console.log('ℹ️ Infobar toggled:', s ? 'hidden' : 'visible');
  });

  function initLayouts(config) {
    console.log('🏗️ Initializing layouts:', config.loader.layouts);
    d3.select(".navi").classed("hide", false);

    config.loader.layouts.forEach((d, i) => {
      if (!d.type && !d.url) {
        d.type = "group";
        d.groupKey = "year";
      }
      if (d.type === "group" && i == 0) {
        console.log('🎯 Setting initial mode:', d.title);
        canvas.setMode(d);
      } else if (d.url) {
        console.log('📊 Loading layout data:', d.url);
        d3.csv(utils.makeUrl(baseUrl.path, d.url), function (tsne) {
          console.log('✅ Layout data loaded:', d.title, tsne.length, 'entries');
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
        console.error("❌ Layout-Objekt in config.json ist fehlerhaft:", d);
        return;
      }
      console.log('🎯 Layout clicked:', d.title);
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

function debugSprites() {
  console.log('🔍 === SPRITE DEBUG ===');
  
  if (!data || !data.length) {
    console.error('❌ No data available for sprite debugging');
    return;
  }
  
  // Prüfe die ersten 10 Sprites
  const spritesToCheck = data.slice(0, 10);
  
  spritesToCheck.forEach((d, i) => {
    if (d.sprite) {
      console.log(`🎭 Sprite ${i} (${d.id}):`);
      console.log('  Position:', d.sprite.position.x, d.sprite.position.y);
      console.log('  Scale:', d.sprite.scale.x, d.sprite.scale.y);
      console.log('  Alpha:', d.sprite.alpha);
      console.log('  Visible:', d.sprite.visible);
      console.log('  Texture valid:', d.sprite.texture && d.sprite.texture.valid);
      console.log('  Texture size:', d.sprite.texture ? `${d.sprite.texture.width}x${d.sprite.texture.height}` : 'no texture');
      console.log('  Parent:', d.sprite.parent ? d.sprite.parent.constructor.name : 'null');
      console.log('  Data active:', d.active);
      console.log('  Data alpha:', d.alpha);
      console.log('  Data visible:', d.visible);
      console.log('  ---');
    } else {
      console.log(`❌ Item ${i} (${d.id}) has no sprite`);
    }
  });
  
  // Prüfe die Stage-Hierarchie
  if (typeof stage !== 'undefined') {
    console.log('🎪 Stage hierarchy:');
    console.log('  stage children:', stage.children.length);
    if (typeof stage2 !== 'undefined') console.log('  stage2 children:', stage2.children.length);
    if (typeof stage3 !== 'undefined') console.log('  stage3 children:', stage3.children.length);
    if (typeof stage4 !== 'undefined') console.log('  stage4 children:', stage4.children.length);
    if (typeof stage5 !== 'undefined') console.log('  stage5 children:', stage5.children.length);
  }
  
  // Prüfe Canvas-Dimensionen
  if (canvas) {
    console.log('📐 Canvas dimensions:');
    console.log('  width:', canvas.width());
    console.log('  height:', canvas.height());
  }
  
  if (typeof renderer !== 'undefined') {
    console.log('  renderer size:', renderer.width, 'x', renderer.height);
  }
  
  // Prüfe Zoom/Scale
  if (typeof scale !== 'undefined' && typeof translate !== 'undefined') {
    console.log('🔍 Zoom/Transform:');
    console.log('  scale:', scale);
    console.log('  translate:', translate);
  }
  
  // Prüfe aktive Daten
  const activeData = data.filter(d => d.active);
  const visibleData = data.filter(d => d.visible);
  console.log('📊 Data stats:');
  console.log('  Total:', data.length);
  console.log('  Active:', activeData.length);
  console.log('  Visible:', visibleData.length);
  console.log('  With sprites:', data.filter(d => d.sprite).length);
  console.log('  With textures:', data.filter(d => d.sprite && d.sprite.texture && d.sprite.texture.valid).length);
}

function forceInitialVisibility() {
  console.log('🔧 Force initial visibility...');
  
  if (!data || !data.length) {
    console.error('❌ No data available for visibility forcing');
    return;
  }
  
  let madeSpriteVisible = false;
  
  data.forEach((d, i) => {
    if (d.sprite && d.sprite.texture && d.sprite.texture.valid) {
      // Setze grundlegende Eigenschaften
      d.active = true;
      d.alpha = 1;
      d.visible = true;
      d.sprite.alpha = 1;
      d.sprite.visible = true;
      
      // Setze eine sichtbare Position für die ersten paar Sprites
      if (i < 20) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        d.sprite.position.x = 50 + col * 120;
        d.sprite.position.y = 50 + row * 120;
        d.sprite.scale.x = 0.3;
        d.sprite.scale.y = 0.3;
        
        madeSpriteVisible = true;
        
        if (i < 5) {
          console.log(`✅ Sprite ${i} (${d.id}) positioned at:`, d.sprite.position.x, d.sprite.position.y);
        }
      }
    }
  });
  
  console.log('📊 Visibility forcing complete:', madeSpriteVisible ? 'sprites positioned' : 'no sprites positioned');
  
  // Aktualisiere die Canvas-Darstellung
  if (canvas && canvas.wakeup) {
    canvas.wakeup();
  }
  
  // Teste auch das normale Projektionssystem
  console.log('📐 Calling canvas.project()...');
  if (canvas && canvas.project) {
    canvas.project();
  }
  
  // Zusätzliche Debug-Ausgabe nach kurzer Verzögerung
  setTimeout(() => {
    console.log('🔍 Post-visibility check:');
    const visibleSprites = data.filter(d => d.sprite && d.sprite.visible && d.sprite.alpha > 0);
    console.log('  Visible sprites:', visibleSprites.length);
    
    if (visibleSprites.length === 0) {
      console.warn('⚠️ NO SPRITES ARE VISIBLE!');
      console.log('Checking possible issues...');
      
      // Prüfe ob Canvas-Element existiert
      const canvasElement = document.querySelector('canvas');
      if (canvasElement) {
        console.log('✅ Canvas element found:', canvasElement.width, 'x', canvasElement.height);
      } else {
        console.error('❌ No canvas element found in DOM');
      }
      
      // Prüfe Stage-Sichtbarkeit
      if (typeof stage !== 'undefined') {
        console.log('Stage visible:', stage.visible);
        console.log('Stage alpha:', stage.alpha);
        console.log('Stage scale:', stage.scale.x, stage.scale.y);
      }
    }
  }, 1000);
}

d3.select(".browserInfo").classed("show", utils.isMobile());

console.log('🏁 viz.js loaded completely');
