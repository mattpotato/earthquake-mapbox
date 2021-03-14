import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import mapboxgl, { MapboxGeoJSONFeature } from "mapbox-gl";
import {
  booleanPointInPolygon,
  Feature,
  FeatureCollection,
  multiPolygon,
} from "@turf/turf";
import ReactDOM from "react-dom";

mapboxgl.accessToken =
  "pk.eyJ1IjoibWF0dHBvdGF0byIsImEiOiJja202MzNhdXMwN212MnBzOWxxYWpyZ3FjIn0.-taQ2UcKKv77FabkRchXEA";

const data: FeatureCollection = require("./earthquakes.json");
const countries = require("./countries.json");

const fetchBoundingBox = async (countryCode: string) => {
  const data = await fetch(
    `http://inmagik.github.io/world-countries/countries/${countryCode}.json`
  );
  return await data.json();
};
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
  const [list, setList] = useState<any[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Feature | {}>({});
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef<{ map: mapboxgl.Map | null }>({
    map: null,
  });

  const loadCountries = () => {
    const temp: string[] = [];
    countries.features.forEach((country: any) => {
      temp.push(country);
    });
    setList(temp);
  };
  useEffect(() => {
    loadCountries();
    if (mapContainer.current) {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v11?optimize=true",
        center: [lng, lat],
        zoom: zoom,
      });

      mapRef.current.map = map;
      map.on("load", () => {
        setLoaded(true);
        // map.on("move", () => {
        //   setLng(Number(map.getCenter().lng.toFixed(4)));
        //   setLat(Number(map.getCenter().lat.toFixed(4)));
        //   setZoom(Number(map.getZoom().toFixed(2)));
        // });

        map.on("mouseenter", "points", function () {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "points", function () {
          map.getCanvas().style.cursor = "";
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
  }, []);

  const loadMarkers = useCallback(() => {
    const map = mapRef.current.map;
    if (map) {
      map.addSource("earthquakes", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: data.features.filter((feature: any, index: number) => {
            const coord = feature.geometry.coordinates;
            if (selectedCountry && (selectedCountry as any).geometry) {
              const poly = multiPolygon(
                (selectedCountry as any).geometry.coordinates
              );
              return booleanPointInPolygon(coord, poly);
            }
            return false;
          }) as any,
        },
      });
      map.addLayer({
        id: "points",
        type: "circle",
        source: "earthquakes",

        paint: {
          "circle-color": "blue",
          "circle-radius": 5,
        },
      });
    }
  }, [mapRef, selectedCountry]);

  useEffect(() => {
    if (loaded && mapRef.current.map && selectedCountry) {
      const map = mapRef.current.map;
      if (map.getSource("earthquakes") && map.getLayer("points")) {
        map.removeLayer("points");
        map.removeSource("earthquakes");
      }
      loadMarkers();
    }
  }, [mapRef, selectedCountry, loaded, loadMarkers]);

  return (
    <div className="App">
      {/* <div className="sidebar">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div> */}
      <div style={{ position: "absolute", zIndex: 10 }}>
        <select>
          {list.map((country, index) => (
            <option
              key={index}
              onClick={async () => {
                setSelectedCountry(country);
              }}
            >
              {country.properties.ADMIN}
            </option>
          ))}
        </select>
        <button id="fit">Fit to bounds</button>
      </div>
      <div className="map-container" ref={mapContainer}></div>
    </div>
  );
}

export default App;
