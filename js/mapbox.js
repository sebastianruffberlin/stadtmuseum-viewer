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
      // Optional: Lade eine GeoJSON-Datei für die Bezirksgrenze
      // Wenn du diese Datei nicht hast, kannst du die nächsten 12 Zeilen auskommentieren.
      var geojsonUrl = "data/pankow.geojson";
      map.addSource("pankow", { type: "geojson", data: geojsonUrl });
      map.addLayer({
        id: "pankow",
        type: "line",
        source: "pankow",
        layout: {},
        paint: {
          "line-color": "#ED6B4C",
          "line-width": 3,
        },
      });
      mapbox.project();
    });
  };

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
