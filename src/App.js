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


//GLOBAL VARIABLES
const url = "park.tif";
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoiam9ldmVjeiIsImEiOiJja3lpcms5N3ExZTAzMm5wbWRkeWFuNTA3In0.dHgiiwOgD-f7gD7qP084rg';

let loaded = false;
let image;
let rgb;

//THIS WORKS FINE
async function getGeotiff(){
  let response;
  let arrayBuffer;
  let tiff;

  response = await fetch(url);
  console.log(response);
  arrayBuffer = await response.arrayBuffer();
  console.log(arrayBuffer);
  tiff = await fromArrayBuffer(arrayBuffer);
  console.log(tiff);
  image = await tiff.getImage(0);
  console.log(image);
  rgb = await image.readRGB()
  console.log(rgb);

  const origin = image.getOrigin();
  const resolution = image.getResolution();
  const bbox = image.getBoundingBox();

  console.log("origin " + origin);
  console.log("resolution " + resolution);
  console.log("bounding box " + bbox);

  loaded = true;
}

getGeotiff();

//THE FUTURE IMG ELEMENT
let snapshot;

//THE OFFSCREEN CANVAS FOR P5 LIBRARY
let board;
let done = false;

//SETUP RUNS ONCE. SET "draw" TO RUN ONCE A SECOND
let setup = async (p5, canvasParentRef) => {
  p5.frameRate(1);
};

//MEANWHILE DRAW RUNS EVERY SECOND. ONCE "getGeoTiff()"" sets "loaded" to true, parse the image
//AND SET "SNAPSHOT" TO POINT TO THE NEWLY MADE IMG
let draw = (p5) => {
  if(loaded == true){
    if(done == false){
      board = p5.createGraphics(image.getWidth(),image.getHeight())
      board.background(255);
      board.loadPixels();

      let offset = 0;

      if(board.pixels.length > rgb.length){
        for(let i = 0; i < board.pixels.length; i+=1){
          if(i%4!=0){
            offset += 1;
          }
          board.pixels[i] = rgb[offset];
          if(i%4==0){
            board.pixels[i-1] = 255;
          }
        }
      }else if(board.pixels.length == rgb.length){
        for(let i = 0; i < board.pixels.length; i+=1){
          board.pixels[i] = rgb[i];
        }
      }

      board.updatePixels();
      snapshot = p5.createImg(board.elt.toDataURL());
      console.log("image loaded: ");
      console.log(snapshot);
      done = true;
    }
  }
};

//THE REACT COMPONENT DRAWING THE IMAGE STORED IN THE "snapshot" VARIABLE AND A MAP WITH THE SAME IMAGE ON IT.
class ImageMap extends React.Component{
  constructor(props){
    super(props);
    this.state = {image, loaded};
  }

  componentDidUpdate(prevProps) {
    // Typical usage (don't forget to compare props):
    if (this.props.image !== prevProps.image) {
      console.log("stuff changed");
    }
  }

  render(){
    const INITIAL_VIEW_STATE = {longitude: -122.41669,latitude: 37.7853,zoom: 13};

    //LAYERS FOR DECKGL. LineLayer TO DRAW A RANDOM LINE. BitmapLayer TO DRAW THE "snapshot" ON IT.
    const layers = [
      new LineLayer({id: 'line-layer', data: [{sourcePosition: [-122.41669, 37.7853], targetPosition: [-122.41669, 37.781]}]}),
      new BitmapLayer({id: 'bitmap-layer', bounds: [-122.5190, 37.7045, -122.355, 37.829], image: this.props.image})
    ];

    console.log("ImageMap is rerendering");
    console.log("Loaded image: ");
    console.log(this.state.image);

    return(
      <div>
      //DRAW THE IMAGE FROM PROPS (WHICH LOADS AT ANY TIME)
      <img src = {this.props.image} />
      //DRAW THE DECKGL COMPONENT CONTAINING THE "layers" VARIABLE. CORRECTLY LOADS LineLayer, NOT BirmapLayer WITH THE CORRECT IMAGE ("snapshot" variable)
      <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers} >
      <MapView id="map" width="100%" height="70%" top="100px" controller={true}>
      <StaticMap mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN} />
      </MapView>
      </DeckGL>
      <h1> Map: </h1>
      </div>
    );
  }
}

function App() {

  return (
    <div className="App">
    <h1> DECK.GL GEOTIFF TEST </h1>
    //RUN THE SKETCH (SETUP ONCE AND DRAW EVERY SECOND)
    <Sketch setup={setup} draw={draw} className="P5" />
    //RENDER THE IMAGEMAP COMPONENT, PASS THE "snapshot" CONTAINING THE IMAGE AND IF THE IMAGE IS LOADED
    <ImageMap image={snapshot} loaded={done}/>
    </div>
  );
}

export default App;
