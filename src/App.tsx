import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import mapboxgl, { MapboxGeoJSONFeature } from "mapbox-gl";
import {
  bbox,
  bboxPolygon,
  booleanPointInPolygon,
  FeatureCollection,
  multiPolygon,
} from "@turf/turf";
import ReactDOM from "react-dom";
import Select from "react-select";

mapboxgl.accessToken =
  "pk.eyJ1IjoibWF0dHBvdGF0byIsImEiOiJja204c2k5M2EwNDBsMnVxbG45bnJncjEyIn0.Wd4RHNcTZSnruMJytd_o9w";

const data: FeatureCollection = require("./earthquakes.json");
const countries = require("./countries.json");

const options = countries.features.map((country: any) => {
  return {
    label: country.properties.ADMIN,
    value: country,
  };
});
options.unshift({ label: "All Countries", value: "All Countries" });

const Details: React.FC<{ data: MapboxGeoJSONFeature }> = ({ data }) => {
  return (
    <>
      <div>Magnitude: {data.properties!.mag}</div>
      <div>Title: {data.properties!.title}</div>
      <div>Timestamp: {data.properties!.time}</div>
    </>
  );
};

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [lng, setLng] = useState(-70.9);
  const [lat, setLat] = useState(42.35);
  const [zoom, setZoom] = useState(2);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<{
    label: string;
    value: any;
  }>({
    label: "All Countries",
    value: "All Countries",
  });
  const mapRef = useRef<{ map: mapboxgl.Map | null }>({
    map: null,
  });

  useEffect(() => {
    // initial render, setup map
    if (mapContainer.current) {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v11?optimize=true",
        center: [lng, lat],
        zoom: zoom,
      });

      mapRef.current.map = map;
      map.on("load", () => {
        setStyleLoaded(true);

        map.loadImage(
          "http://localhost:3000/mapbox-icon.png",
          (error, image: any) => {
            if (error) throw error;
            map.addImage("marker", image);
          }
        );

        map.on("mouseenter", "points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "points", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "clusters", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "clusters", () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", "clusters", (e) => {
          var features = map.queryRenderedFeatures(e.point, {
            layers: ["clusters"],
          });
          var clusterId = (features[0] as any).properties.cluster_id;
          (map.getSource("earthquakes") as any).getClusterExpansionZoom(
            clusterId,
            function (err: any, zoom: any) {
              if (err) return;

              map.easeTo({
                center: (features[0].geometry as any).coordinates,
                zoom: zoom,
              });
            }
          );
        });

        map.on("click", "points", (marker) => {
          if (marker.features && marker.features[0].geometry.type === "Point") {
            const coordinates = marker.features[0]!.geometry.coordinates.slice();
            const popup = document.createElement("div");
            ReactDOM.render(
              (<Details data={marker.features[0]} />) as any,
              popup as any
            );

            while (Math.abs(marker.lngLat.lng - coordinates[0]) > 180) {
              coordinates[0] += marker.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            new mapboxgl.Popup()
              .setLngLat([coordinates[0], coordinates[1]])
              .setDOMContent(popup as any)
              .addTo(map);
          }
        });
      });
      return () => map.remove();
    }
  }, [lat, lng, zoom]);

  const loadMarkers = useCallback(() => {
    // load the markers
    const map = mapRef.current.map;
    if (map) {
      if (selectedCountry.label === "All Countries") {
        map.addSource("earthquakes", {
          type: "geojson",
          data: data as any,
          cluster: true,
          clusterMaxZoom: 14, // Max zoom to cluster points on
          clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
        });
      } else {
        const filteredFeatures = data.features.filter((feature: any) => {
          const coord = feature.geometry.coordinates;
          let belongsToCountry = false;
          if (selectedCountry && selectedCountry.value.geometry) {
            const poly = multiPolygon(
              selectedCountry.value.geometry.coordinates
            );
            belongsToCountry = booleanPointInPolygon(coord, poly);
          }
          return belongsToCountry;
        }) as any;
        map.addSource("earthquakes", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: filteredFeatures,
          },
          cluster: true,
          clusterMaxZoom: 14, // Max zoom to cluster points on
          clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
        });
      }

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "earthquakes",
        filter: ["has", "point_count"],
        paint: {
          // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
          // with three steps to implement three types of circles:
          //   * Blue, 20px circles when point count is less than 100
          //   * Yellow, 30px circles when point count is between 100 and 750
          //   * Pink, 40px circles when point count is greater than or equal to 750
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#51bbd6",
            100,
            "#f1f075",
            750,
            "#f28cb1",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            100,
            30,
            750,
            40,
          ],
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "earthquakes",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
      });

      map.addLayer({
        id: "points",
        type: "symbol",
        source: "earthquakes",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": "marker",
          "icon-size": 0.25,
        },
      });
      // Zoom to selected country
      // Note: behaves weirdly on big countries like United States and Russia
      if (selectedCountry.value.geometry) {
        const box = bbox(selectedCountry.value);
        const polygon = bboxPolygon(box);
        map.fitBounds(polygon.bbox as any);
      }
    }
  }, [mapRef, selectedCountry]);

  const handleChange = (value: any) => {
    setSelectedCountry(value);
  };

  useEffect(() => {
    const map = mapRef.current.map;
    if (styleLoaded && map && selectedCountry) {
      if (map.getLayer("cluster-count")) {
        map.removeLayer("cluster-count");
      }
      if (map.getLayer("clusters")) {
        map.removeLayer("clusters");
      }
      if (map.getLayer("points")) {
        map.removeLayer("points");
      }
      if (map.getSource("earthquakes")) {
        map.removeSource("earthquakes");
      }
      loadMarkers();
    }
  }, [mapRef, selectedCountry, styleLoaded, loadMarkers]);

  return (
    <div className="App">
      <div className="searchbar">
        <Select
          options={options}
          value={selectedCountry}
          onChange={handleChange}
        />
      </div>
      <div className="map-container" ref={mapContainer}></div>
    </div>
  );
}

export default App;
