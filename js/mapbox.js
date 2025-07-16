mapboxgl.accessToken = "pk.eyJ1Ijoic2ViYXN0aWFucnVmZiIsImEiOiJjbWQ1b2owZHIwMHI1MnFxdmRmNjJtbncyIn0.EIrTJNvQNVYDvcPVYSYj5g"; // <-- HIER DEINEN EIGENEN TOKEN EINFÜGEN

function Mapbox() {
  var state = {
    open: false,
  };

  var map;
  var initialZoom;
  var initialCenter;
  var projected;
  var validData;
  var bounds;
  function mapbox() {}

  mapbox.init = function (data) {
    data.forEach((d) => {
      d.lat = Number(d._Lat);
      d.lng = Number(d._Lon);
    });

    validData = data.filter((d) => !isNaN(d.lat) && !isNaN(d.lng));

    var extent = [
      d3.extent(validData, function (d) {
        return d.lng;
      }),
      d3.extent(validData, function (d) {
        return d.lat;
      }),
    ];

    bounds = [
      [extent[0][0], extent[1][0]],
      [extent[0][1], extent[1][1]],
    ];
    console.log("Map bounds calculated:", bounds);

    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v9",
      bounds: bounds,
      fitBoundsOptions: { padding: 200 },
      interactive: false,
    });

    window.mapbox = map;

    map.on("load", function () {
  var geojsonUrl = "data/berlin_bezirke.geojson"; // Dein neuer Dateiname
  
  // 1. Datenquelle hinzufügen
  map.addSource("bezirke", {
    type: "geojson",
    data: geojsonUrl
  });

  // 2. Eine Ebene für die Füllfarbe der Bezirke hinzufügen
  map.addLayer({
    id: "bezirke-fill",
    type: "fill",
    source: "bezirke",
    paint: {
      "fill-color": "#ED6B4C", // Die Füllfarbe (z.B. das Orange)
      "fill-opacity": 0.2     // Eine leichte Transparenz
    }
  });

  // 3. Eine Ebene für die Umrandung der Bezirke hinzufügen
  map.addLayer({
    id: "bezirke-borders",
    type: "line",
    source: "bezirke",
    paint: {
      "line-color": "#ED6B4C", // Die Linienfarbe
      "line-width": 2
    }
  });

  // 4. Interaktivität: Popup beim Klick auf einen Bezirk
  map.on('click', 'bezirke-fill', function (e) {
    // HINWEIS: 'BEZIRKSNAME' ist eine Eigenschaft in der GeoJSON-Datei.
    // Prüfe in deiner Datei, wie die Spalte mit dem Namen heißt (z.B. 'NAME' oder 'BEZ_NAME') und passe es hier an.
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML('<h3>' + e.features[0].properties.BEZIRKSNAME + '</h3>')
      .addTo(map);
  });

  // Ändere den Mauszeiger zu einem "Pointer", wenn er über einem Bezirk ist
  map.on('mouseenter', 'bezirke-fill', function () {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'bezirke-fill', function () {
    map.getCanvas().style.cursor = '';
  });

  // Wichtig: Rufe die Projektion auf, nachdem alles geladen ist
  mapbox.project();
});

  mapbox.project = function () {
    console.log("Projecting map data to canvas.");
    map.fitBounds(bounds, {
      padding: 100,
      linear: true,
      animate: false,
      offset: [50, 20],
    });

    var projected = validData.map((d) => {
      var point = map.project([d.lng, d.lat]);
      return {
        id: d.id,
        x: point.x,
        y: point.y,
      };
    });

    initialZoom = map.getZoom();
    initialCenter = map.getCenter();
    
    canvas.setMapData(projected);
  };

  mapbox.zoom = function (center, mousePos, scale, translate, imageSize) {
    if (!map) return;
    
    if (initialCenter) {
      var x0 = translate[0] + (canvas.width() * scale - canvas.width()) / 2;
      var y0 = translate[1] + (canvas.height() * scale - canvas.height()) / 2;
      
      var x = canvas.width() / 2 + x0;
      var y = canvas.height() / 2 + y0;

      var zoom = initialZoom + Math.log(scale) / Math.LN2;

      map.setZoom(zoom);
      map.transform.setLocationAtPoint(initialCenter, new mapboxgl.Point(x, y));
    }
  };

  return mapbox;
}
}
