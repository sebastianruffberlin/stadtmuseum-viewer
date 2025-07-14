// christopher pietsch
// cpietsch@gmail.com
// 2015-2018

function Tags() {
  var margin = { top: 10, right: 20, bottom: 20, left: 10 },
    width = window.innerWidth - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  var container;
  var keywordsScale = d3.scale.linear();
  var keywordsOpacityScale = d3.scale.linear();
  var keywords = [];
  var wordBackground;
  var keywordsNestGlobal;

  var filterWords = [];
  var data, filteredData;
  var activeWord;

  var x = d3.scale.ordinal().rangeBands([0, width]);

  var sliceScale = d3.scale.linear().domain([1200, 5000]).range([50, 200]);

  var lock = false;
  var state = { init: false, search: "" };

  function tags() {}

  tags.state = state;

  tags.init = function (_data, config) {
    data = _data;
    console.log("Tags Init - Datenanzahl:", data.length);
    console.log("Tags Init - Erste Keywords:", data[0].keywords);

    container = d3
      .select(".page")
      .append("div")
      .style("width", width + margin.left + margin.right)
      .style("height", height + margin.top + margin.bottom)
      .classed("tagcloud", true)
      .style("color", config.style.fontColor)
      .append("div");

    console.log("Tags Container erstellt:", container.node());
    tags.update();
  };

  tags.resize = function () {
    if (!state.init) return;

    (width = window.innerWidth - margin.left - margin.right),
      (height = 400 - margin.top - margin.bottom);

    container
      .style("width", width + margin.left + margin.right)
      .style("height", height + margin.top + margin.bottom);

    x.rangeBands([0, width]);

    tags.update();
  };

  tags.filter = function (filterWords, highlight) {
    data.forEach(function (d) {
      var search =
        state.search !== "" ? d.search.indexOf(state.search) > -1 : true;
      
      if (filterWords.length === 0) {
        // Ohne Filter: alle Objekte aktiv
        if (highlight) d.highlight = search;
        else d.active = search;
      } else {
        // Mit Filter: prüfe ob das Objekt alle Filterbedingungen erfüllt
        var matches = filterWords.filter(function (word) {
          return d.keywords.some(function(keyword) {
            // Match wenn:
            // 1. Exakte Übereinstimmung (z.B. "Stil" === "Stil")
            // 2. Hierarchische Übereinstimmung (z.B. "Stil>Realism" beginnt mit "Stil>")
            // 3. Unterkategorie-Match (z.B. "Browns" in "Hauptfarbe>Browns")
            return keyword === word || 
                   keyword.startsWith(word + '>') ||
                   keyword.endsWith('>' + word);
          });
        });
        
        if (highlight)
          d.highlight = matches.length == filterWords.length && search;
        else 
          d.active = matches.length == filterWords.length && search;
      }
    });
  };

  tags.update = function () {
    console.log("Tags Update - filterWords:", filterWords);
    tags.filter(filterWords);

    var keywords = [];
    data.forEach(function (d) {
      if (d.active) {
        d.keywords.forEach(function (keyword) {
          keywords.push({ keyword: keyword, data: d });
        });
      }
    });

    console.log("Tags Update - Gefundene Keywords:", keywords.length);
    console.log("Tags Update - Beispiel Keywords:", keywords.slice(0, 5).map(k => k.keyword));

    var filterWordsReverse = filterWords.map((d) => d).reverse();

    // Schritt 1: Erstelle Oberkategorien basierend auf gefilterten Daten
    // Verwende Keywords von aktiven Objekten, damit Oberkategorien bereits gefiltert sind
    var topLevelCategories = d3
      .nest()
      .key(function (d) {
        return d.keyword.split('>')[0]; // Oberkategorie
      })
      .rollup(function (d) {
        return d.map(function (d) {
          return d.data;
        });
      })
      .entries(keywords) // keywords enthält bereits nur Keywords von aktiven Objekten
      .sort(function (a, b) {
        var y1 = d3.max(a.values.map((d) => +d.year));
        var y2 = d3.max(b.values.map((d) => +d.year));
        return d3.descending(y1, y2);
      });

    // Schritt 2: Erstelle Unterkategorien für aktive Oberkategorien
    var subCategories = [];
    if (filterWords.length > 0) {
      // Für jede aktive Oberkategorie Unterkategorien erstellen
      filterWords.forEach(function(activeTopCategory) {
        // Finde alle Keywords dieser Oberkategorie in den bereits gefilterten Daten
        var keywordsForThisTop = keywords.filter(function(item) {
          return item.keyword.startsWith(activeTopCategory + '>');
        });
        
        if (keywordsForThisTop.length > 0) {
          var subCatsForThisTop = d3
            .nest()
            .key(function (d) {
              var parts = d.keyword.split('>');
              return parts.length > 1 ? parts[1] : null;
            })
            .rollup(function (d) {
              return d.map(function (d) {
                return d.data;
              });
            })
            .entries(keywordsForThisTop)
            .filter(function(d) { return d.key !== null; });
            
          subCategories = subCategories.concat(subCatsForThisTop);
        }
      });
      
      subCategories.sort(function (a, b) {
        return d3.ascending(a.key, b.key); // Unterkategorien alphabetisch
      });
    }

    // Schritt 3: Kombiniere Ober- und Unterkategorien horizontal nebeneinander
    keywordsNestGlobal = [];
    
    // Für jede Oberkategorie: erst die Oberkategorie, dann ihre Unterkategorien direkt daneben
    topLevelCategories.forEach(function(topCat) {
      // Oberkategorie hinzufügen
      keywordsNestGlobal.push({
        key: topCat.key,
        display: topCat.key,
        values: topCat.values,
        isTopLevel: true
      });
      
      // Wenn diese Oberkategorie aktiv ist, füge ihre Unterkategorien direkt daneben hinzu
      if (filterWords.indexOf(topCat.key) > -1) {
        var subCatsForThisTop = subCategories.filter(function(subCat) {
          // Prüfe ob diese Unterkategorie zu dieser Oberkategorie gehört
          return keywords.some(function(keywordItem) {
            return keywordItem.keyword === topCat.key + '>' + subCat.key;
          });
        });
        
        // Unterkategorien alphabetisch sortieren
        subCatsForThisTop.sort(function(a, b) {
          return d3.ascending(a.key, b.key);
        });
        
        // Unterkategorien direkt daneben hinzufügen
        subCatsForThisTop.forEach(function(subCat) {
          keywordsNestGlobal.push({
            key: subCat.key,
            display: subCat.key,
            values: subCat.values,
            isTopLevel: false,
            parentCategory: topCat.key
          });
        });
      }
    });

    console.log("keywordsNestGlobal nach Verarbeitung:", keywordsNestGlobal.length);
    console.log("Erste 5 Kategorien:", keywordsNestGlobal.slice(0, 5).map(k => k.key));

    var sliceNum = parseInt(sliceScale(width));

    var keywordsNest = keywordsNestGlobal
      .slice(0, sliceNum);

    console.log("keywordsNest für Display:", keywordsNest.length);
    console.log("keywordsNest", keywordsNest);

    var keywordsExtent = d3.extent(keywordsNest, function (d) {
      return d.values.length;
    });

    keywordsScale.domain(keywordsExtent).range([10, 20]);

    if (keywordsExtent[0] == keywordsExtent[1] || !filterWords.length)
      keywordsScale.range([15, 15]);

    keywordsOpacityScale.domain(keywordsExtent).range([0.2, 1]);

    layout(keywordsNest);
    tags.draw(keywordsNest);
  };

  function layout(data) {
    var p = 1.8;
    var p2 = 1;
    var x0 = 0;

    data.forEach(function (d) {
      d.x = x0 + keywordsScale(d.values.length) * p + p2;
      x0 += keywordsScale(d.values.length) * p;
    });
  }

  function getTranslateForList(data) {
    if (!data || data.length === 0 || !_.last(data)) return 0;
    var w = _.last(data).x + 100;
    return width / 2 - w / 2;
  }

  tags.draw = function (words) {
    console.log("Tags Draw - Anzahl Wörter:", words.length);

    var select = container.selectAll(".tag").data(words, function (d) {
      return d.display;
    });

    select
      .classed("active", function (d) {
        return filterWords.indexOf(d.key) > -1;
      })
      .style("transform", function (d, i) {
        return "translate(" + d.x + "px,0px) rotate(45deg)";
      })
      .style("font-size", function (d) {
        return keywordsScale(d.values.length) + "px";
      })
      .style("opacity", 1);

    var e = select
      .enter()
      .append("div")
      .classed("tag", true)
      .on("mouseenter", tags.mouseenter)
      .on("mouseleave", tags.mouseleave)
      .on("click", tags.mouseclick)
      .style("transform", function (d, i) {
        return "translate(" + d.x + "px,0px) rotate(45deg)";
      })
      .style("font-size", function (d) {
        return keywordsScale(d.values.length) + "px";
      })
      .style("opacity", 0);

    e.append("span").text(function (d) {
      return d.display;
    });

    e.append("div").classed("close", true);

    e.transition()
      .delay(400)
      .duration(0)
      .style("transform", function (d, i) {
        return "translate(" + d.x + "px,0px) rotate(45deg)";
      })
      .style("font-size", function (d) {
        return keywordsScale(d.values.length) + "px";
      })
      .style("opacity", 1);

    select
      .exit()
      .style("opacity", 0)
      .remove();

    if (words.length === 0) return;

    var w = getTranslateForList(words);

    container.style("transform", function (d, i) {
      return "translate(" + w + "px,0px)";
    });
  };

  tags.reset = function () {
    filterWords = [];
    tags.update();
    tags.highlightWords(filterWords);
  };

  tags.mouseclick = function (d) {
    lock = true;

    if (filterWords.indexOf(d.key) > -1) {
      // Filter entfernen
      _.remove(filterWords, function (d2) {
        return d2 == d.key;
      });
      
      // Wenn es eine Oberkategorie war, entferne auch alle zugehörigen Unterkategorien
      // Prüfe ob d.key eine Oberkategorie ist (enthält kein '>')
      if (d.key.indexOf('>') === -1) {
        var topCategory = d.key;
        // Entferne alle Unterkategorien, die zu dieser Oberkategorie gehören
        // Das sind die Strings, die als Unterkategorien dieser Oberkategorie auftreten können
        var subCategoriesOfThisTop = [];
        
        // Sammle alle möglichen Unterkategorien dieser Oberkategorie
        data.forEach(function(dataItem) {
          dataItem.keywords.forEach(function(keyword) {
            if (keyword.startsWith(topCategory + '>')) {
              var parts = keyword.split('>');
              if (parts.length === 2) {
                var subCat = parts[1];
                if (subCategoriesOfThisTop.indexOf(subCat) === -1) {
                  subCategoriesOfThisTop.push(subCat);
                }
              }
            }
          });
        });
        
        // Entferne alle diese Unterkategorien aus filterWords
        _.remove(filterWords, function(filterWord) {
          return subCategoriesOfThisTop.indexOf(filterWord) > -1;
        });
      }
    } else {
      filterWords.push(d.key);
    }

    tags.update();
    tags.highlightWords(filterWords);

    setTimeout(function () {
      canvas.project(d);
    }, 300);

    lock = false;
  };

  tags.mouseleave = function (d) {
    if (lock) return;

    container.selectAll(".tag").style("opacity", 1);

    data.forEach(function (d) {
      d.highlight = d.active;
    });

    canvas.highlight();
  };

  tags.mouseenter = function (d1) {
    if (lock) return;

    var tempFilterWords = _.clone(filterWords);
    tempFilterWords.push(d1.key);

    tags.highlightWords(tempFilterWords);
  };

  tags.filterWords = function (words) {
    tags.filter(words, 1);

    container.selectAll(".tag").style("opacity", function (d) {
      return d.values.some(function (d) {
        return d.active;
      })
        ? 1
        : 0.2;
    });

    canvas.highlight();
  };

  tags.highlightWords = function (words) {
    tags.filter(words, 1);

    container.selectAll(".tag").style("opacity", function (d) {
      return d.values.some(function (d) {
        return d.highlight;
      })
        ? 1
        : 0.2;
    });

    canvas.highlight();
  };

  tags.search = function (query) {
    state.search = query;

    tags.filter(filterWords, true);
    tags.update();
    canvas.highlight();
    canvas.project();
  };

  return tags;
}
