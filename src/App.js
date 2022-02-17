import './App.css';
import React from "react";
import DeckGL from '@deck.gl/react';
import {LineLayer} from '@deck.gl/layers';
import {BitmapLayer} from '@deck.gl/layers';
import {MapView} from "@deck.gl/core"
import {FirstPersonView} from "@deck.gl/core"
import {Deck} from "@deck.gl/core"
import {StaticMap} from 'react-map-gl';
import {fromArrayBuffer} from 'geotiff';
import Sketch from "react-p5";
import {printMsg} from "geoimage"

const url = "dsm.tif";
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoiam9ldmVjeiIsImEiOiJja3lpcms5N3ExZTAzMm5wbWRkeWFuNTA3In0.dHgiiwOgD-f7gD7qP084rg';

const scale = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
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

  return image;
}

async function geoImg(geoTiffData){
  const width = await geoTiffData.getWidth();
  const height = await geoTiffData.getHeight();
  const rasters = await geoTiffData.readRasters();
  const channels = rasters.length;

  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let c = canvas.getContext('2d');
  let imageData = c.createImageData(width, height);
  console.log("resolution: " + width + " * " + height);

  //TRUE : COLOR RANGE WILL BE ADJUSTED FOR HIGHS AND LOWS OF THIS PICTURE
  //FALSE : COLOR RANGE WILL BE ADJUSTED FOR RANGE MIN, RANGE MAX
  const use_auto_range = true;
  let range_min = 0;
  let range_max = 255;

  //TRUE : DON'T RENDER ANYTHING WITH VALUE < CLIP_LOW OR VALUE > CLIP_HIGH
  //FALSE : ALL VALUES WILL BE RENDERED
  const use_clip = false;
  const clip_low = 240;
  const clip_high = Number.MAX_VALUE;

  //TRUE : RENDER VALUES FROM LOWEST IN BLUE TO HIGHEST IN RED
  //FALSE : RENDER VALUES IN THE SPECIFIED COLOR
  const use_heat_map = true;
  let color = [255,0,255];

  //TRUE : LOWS RENDER MORE TRANSPARENT. HIGHS RENDER MORE OPAQUE
  //FALSE : DATA GETS RENDERED WITH THE SPECIFIED OPACITY
  const use_data_for_opacity = false;
  let opacity = 150;


  let r,g,b,a;

  if(channels == 1){
    //AUTO RANGE
    if(use_auto_range){
      let highest = Number.MIN_VALUE;
      let lowest = Number.MAX_VALUE;
      let value = [];
      for(let i = 0; i < rasters[0].length; i++){
        value = rasters[0][i];
        if(value > highest) highest = value;
        if(value < lowest) lowest = value;
      }
      range_min = lowest;
      range_max = highest;
      console.log("Auto-range enabled. Detected min: " + range_min + ", max: " + range_max);
    }

    let pixel = 0;
    for(let i = 0; i < width*height*4; i+=4){//MONOCHROME DATA
      if(use_heat_map) color = heatmap(rasters[0][pixel],range_min,range_max,0,255);

      r = color[0];
      g = color[1];
      b = color[2];

      a = opacity;

      if((use_clip == true) && (rasters[0][pixel] < clip_low || rasters[0][pixel] > clip_high)) a = 0;
      if(use_data_for_opacity) a = scale(rasters[0][pixel],range_min,range_max,0,255);

      imageData.data[i+0] = r;
      imageData.data[i+1] = g;
      imageData.data[i+2] = b;
      imageData.data[i+3] = a;

      pixel++;
    }
  }else if(channels == 3){//RGB
    let pixel = 0;
    for(let i = 0; i < width*height*4; i+=4){
      r = rasters[0][pixel];
      g = rasters[1][pixel];
      b = rasters[2][pixel];
      a = opacity;

      imageData.data[i+0] = r;
      imageData.data[i+1] = g;
      imageData.data[i+2] = b;
      imageData.data[i+3] = a;

      pixel++;
    }
  }else if(channels == 4){//RGBA
    let pixel = 0;
    for(let i = 0; i < width*height*4; i+=4){
      r = rasters[0][pixel];
      g = rasters[1][pixel];
      b = rasters[2][pixel];
      a = rasters[3][pixel];

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

class GeoImg{
  image = new Image();
  boundingBox = [0,0,0,0];

  constructor(image, boundingBox){
    this.image = image;
    this.boundingBox = boundingBox;
  }
}

async function getGeoImg(url){
  let data = await getGeotiffData(url);
  let imgUrl = await geoImg(data);

  let boundingBox = data.getBoundingBox();

  let g = new GeoImg(imgUrl, boundingBox);
  return g;
}

class ImageMap extends React.Component{
  constructor(props){
    super(props);
    this.state = {image : new Image(), boundingBox : [0,0,0,0]};
  }

  async componentDidMount() {
    const data = await getGeoImg(url);
    this.setState({image: data.image, boundingBox: data.boundingBox});
  }

  render(){
    let initial_view_state = {longitude: this.state.boundingBox[0],latitude: this.state.boundingBox[1],zoom: 12};
    //let initial_view_state = {longitude: -95.39842728115566,latitude: 29.763892665956423, zoom: 12};

    const layers = [new BitmapLayer({id: 'bitmap-layer', bounds: this.state.boundingBox, image: this.state.image})];

    return(
      <div>
      <DeckGL
      initialViewState={initial_view_state}
      controller={true}
      layers={layers} >
      <MapView id="map" width="100%" height="100%" top="100px" controller={true}>
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
    <ImageMap GeoImg={new GeoImg}/>
    </div>
  );
}

export default App;
