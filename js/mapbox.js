mapboxgl.accessToken = "pk.eyJ1Ijoic2ViYXN0aWFucnVmZiIsImEiOiJjbWQ1b2owZHIwMHI1MnFxdmRmNjJtbncyIn0.EIrTJNvQNVYDvcPVYSYj5g";

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
    // Wandelt die _Lat und _Lon Spalten aus der CSV in Zahlen um
    data.forEach((d) => {
      d.lat = Number(d._Lat);
      d.lng = Number(d._Lon);
    });

    // Filtert alle Einträge ohne gültige Koordinaten heraus
    validData = data.filter((d) => !isNaN(d.lat) && !isNaN(d.lng));

    // Berechnet den Rahmen (bounding box), der alle Datenpunkte umschließt
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

    // Erstellt die Mapbox-Karte
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v9",
      bounds: bounds,
      fitBoundsOptions: { padding: 200 },
      interactive: false, // Wichtig: Die Karte wird durch die Canvas-Ansicht gesteuert
    });

    window.mapbox = map;

    // Diese Funktion wird ausgeführt, sobald die Karte fertig geladen ist
    map.on("load", function () {
      var geojsonUrl = "data/berlin_bezirke.geojson";
      
      // 1. Fügt die GeoJSON-Datei als Datenquelle hinzu
      map.addSource("bezirke", {
        type: "geojson",
        data: geojsonUrl
      });

      // 2. Fügt eine Ebene für die Füllfarbe der Bezirke hinzu
      map.addLayer({
        id: "bezirke-fill",
        type: "fill",
        source: "bezirke",
        paint: {
          "fill-color": "#ED6B4C",
          "fill-opacity": 0.2
        }
      });

      // 3. Fügt eine Ebene für die Umrandung der Bezirke hinzu
      map.addLayer({
        id: "bezirke-borders",
        type: "line",
        source: "bezirke",
        paint: {
          "line-color": "#ED6B4C",
          "line-width": 2
        }
      });

      // 4. Interaktivität: Zeigt ein Popup beim Klick auf einen Bezirk
      map.on('click', 'bezirke-fill', function (e) {
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML('<h3>' + e.features[0].properties.Gemeinde_name + '</h3>') // Korrekter Eigenschaftsname
          .addTo(map);
      });

      // Ändert den Mauszeiger, wenn er über einem Bezirk ist
      map.on('mouseenter', 'bezirke-fill', function () {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'bezirke-fill', function () {
        map.getCanvas().style.cursor = '';
      });

      // Ruft die Projektion auf, um die Punkte mit der Canvas-Ansicht zu synchronisieren
      mapbox.project();
    });
  };

  // Projiziert die Geodaten auf Pixelkoordinaten für die Canvas-Ansicht
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
    
    // Übergibt die Pixelkoordinaten an die Canvas
    canvas.setMapData(projected);
  };

  // Steuert den Zoom und die Verschiebung der Karte von der Canvas-Ansicht aus
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
