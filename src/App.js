import './App.css';
import React from "react";
import DeckGL from '@deck.gl/react';
import {LineLayer} from '@deck.gl/layers';
import {BitmapLayer} from '@deck.gl/layers';
import {MapView} from "@deck.gl/core"
import {FirstPersonView} from "@deck.gl/core"
import {Deck} from "@deck.gl/core"
import {StaticMap} from 'react-map-gl';
import GeoTIFF, { fromUrl, fromUrls, fromArrayBuffer, fromBlob } from 'geotiff';
import Sketch from "react-p5";

const url = "dsm.tif";
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoiam9ldmVjeiIsImEiOiJja3lpcms5N3ExZTAzMm5wbWRkeWFuNTA3In0.dHgiiwOgD-f7gD7qP084rg';

console.clear();

const scale = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

const clamp = (num, min, max) => {
  return Math.min(Math.max(num, max), min);
}

const heatmap = (num, min, max) => {
    const ratio = 2 * (num-min) / (max - min);
    const b = (Math.max(0, 255*(1 - ratio)));
    const r = (Math.max(0, 255*(ratio - 1)));
    const g = 255 - b - r;
    return [r,g,b];
}

async function getGeotiffData(dataUrl){
  let image;

  const response = await fetch(dataUrl);
  const arrayBuffer = await response.arrayBuffer();
  const tiff = await fromArrayBuffer(arrayBuffer);
  image = await tiff.getImage(0);

  const origin = image.getOrigin();
  const resolution = image.getResolution();
  const bbox = image.getBoundingBox();

  console.log("tiff origin " + origin);
  console.log("tiff resolution " + resolution);
  console.log("tiff bounding box " + bbox);

  return image;
}

async function geoImg(geoTiffData){
  const width = await geoTiffData.getWidth();
  const height = await geoTiffData.getHeight();
  const rasters = await geoTiffData.readRasters();
  const channels = rasters.length;
  const colorBytes = await geoTiffData.getBytesPerPixel();

  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let c = canvas.getContext('2d');
  let imageData = c.createImageData(width, height);

  console.log("resolution: " + width + " * " + height);
  console.log("data bytes per pixel: " + colorBytes);
  console.log("data samples per pixel: " + await geoTiffData.getSamplesPerPixel());

  let range_min = 0;
  let range_max = 255;
  let color = [255,0,255];
  let opacity = 128;
  const use_auto_range = true;
  const use_heat_map = true;
  const use_data_for_opacity = true;

  if(channels == 1){

    //AUTO RANGE
    if(use_auto_range){
      let highest = 0;
      let lowest = 0;
      for(let i = 0; i < rasters[0].length; i++){
        let value = rasters[0][i];
        if(value > highest) highest = value;
        if(value < lowest) lowest = value;
      }
      range_min = lowest;
      range_max = highest;
      console.log("Auto-range enabled. Range min: " + range_min + ", max: " + range_max);
    }
    ///////////

    let pixel = 0;
    for(let i = 0; i < width*height*4; i+=4){
      if(use_heat_map)color = heatmap(rasters[0][pixel],range_min,range_max,0,255);

      let r = color[0];
      let g = color[1];
      let b = color[2];
      let a = opacity;
      if(use_data_for_opacity) a = scale(rasters[0][pixel],range_min,range_max,0,255);

      imageData.data[i+0] = r;
      imageData.data[i+1] = g;
      imageData.data[i+2] = b;
      imageData.data[i+3] = a;

      pixel++;
    }
  }else if(channels == 3){
    let pixel = 0;
    for(let i = 0; i < width*height*4; i+=4){
      let r = rasters[0][pixel];
      let g = rasters[1][pixel];
      let b = rasters[2][pixel];
      let a = 255;

      imageData.data[i+0] = r;
      imageData.data[i+1] = g;
      imageData.data[i+2] = b;
      imageData.data[i+3] = a;

      pixel++;
    }
  }else if(channels == 4){
    let pixel = 0;
    for(let i = 0; i < width*height*4; i+=4){
      let r = rasters[0][pixel];
      let g = rasters[1][pixel];
      let b = rasters[2][pixel];
      let a = rasters[3][pixel];

      imageData.data[i+0] = r;
      imageData.data[i+1] = g;
      imageData.data[i+2] = b;
      imageData.data[i+3] = a;

      pixel++;
    }
  }

  c.putImageData(imageData,0,0);
  let imageUrl = canvas.toDataURL('image/png');
  console.log("Loading finished.");
  return imageUrl;
}

async function geotiffUrlToImg(address){
  let data = await getGeotiffData(address);
  let imgUrl = await geoImg(data);

  data.bitmap = imgUrl;
  return data;
}

class GeoImage{
  image = new Image();
  boundingBox = [0,0,0,0];

  constructor(image, boundingBox){
    this.image = image;
    this.boundingBox = boundingBox;
  }
}

async function getGeoImage(url){
  let data = await getGeotiffData(url);
  let imgUrl = await geoImg(data);

  let boundingBox = data.getBoundingBox();

  let g = new GeoImage(imgUrl, boundingBox);
  return g;
}

class ImageMap extends React.Component{
  constructor(props){
    super(props);
    this.state = {image : new Image(), boundingBox : [0,0,0,0]};
  }

  async componentDidMount() {
    const data = await getGeoImage(url);
    this.setState({image: data.image, boundingBox: data.boundingBox});
  }

  render(){
    let initial_view_state = {longitude: this.state.boundingBox[0],latitude: this.state.boundingBox[1],zoom: 12};
    //let initial_view_state = {longitude: -95.39842728115566,latitude: 29.763892665956423, zoom: 12};

    console.log("Bounding box: " + this.state.boundingBox);

    const layers = [
      new BitmapLayer({id: 'bitmap-layer', bounds: this.state.boundingBox, image: this.state.image}),
      new LineLayer({id: 'line-layer', data: [{sourcePosition: [-122.41669, 37.7853], targetPosition: [-122.41669, 37.781]}]})
    ];

    return(
      <div>
      <DeckGL
      initialViewState={initial_view_state}
      controller={true}
      layers={layers} >
      <MapView id="map" width="100%" height="70%" top="100px" controller={true}>
      <StaticMap mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN} />
      </MapView>
      </DeckGL>
      </div>
    );
  }
}

function App() {

  return (
    <div className="App">
    <h1> DECK.GL GEOTIFF TEST </h1>
    <ImageMap geoImage={new GeoImage}/>
    </div>
  );
}

export default App;
