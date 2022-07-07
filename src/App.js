import './App.css';
import React from "react";
import DeckGL from '@deck.gl/react';
import {TileLayer} from '@deck.gl/geo-layers';
import {BitmapLayer} from '@deck.gl/layers';
import {MapView} from "@deck.gl/core"
import {FirstPersonView} from "@deck.gl/core"
import {Deck} from "@deck.gl/core"
import {StaticMap} from 'react-map-gl';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoiam9ldmVjeiIsImEiOiJja3lpcms5N3ExZTAzMm5wbWRkeWFuNTA3In0.dHgiiwOgD-f7gD7qP084rg';

let maxDepth = 7; //Max zoom level we want to generate bitmaps for. More than 7 for the whole world is really slow.
let tileSize = 256; //Size of one tile

class ImageMap extends React.Component{
  constructor(props){
    super(props);
    this.state = {tiles : {}, image : new Image(), heightMap : new Image(), boundingBox : [0,0,0,0]};
  }

  componentDidMount() {
    let tiles = {}; //bitmaps will be saved by keys such as {'0-0-0', '0-0-1', '0-0-1', ... , '8-8-8'}
    var canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    let context = canvas.getContext("2d");


    for(let z = 0; z < maxDepth; z++){ //For every dept level, generate tiles
      let splits = Math.pow(2, z); //For each level generate this many tiles in each direction (level 1 gets 2 tiles, level 2 gets 4 tiles, level 3 gets 8 tiles, and so on)
      for(let y = 0; y < splits; y++){
        for(let x = 0; x < splits; x++){
          //Generate the bitmap for this tile. Clear canvas, fill with color, put text in, and save the canvas to dataUrl. Put this url as a value to tiles[x-y-z] key.
          context.clearRect(0, 0, tileSize, tileSize);
          context.fillStyle = "rgba(128, 0, 255, 0.5)";
          context.fillRect(0,0,tileSize-2,tileSize-2);
          context.font = "30px Arial";
          context.textAlign = "center";
          context.fillStyle = "#FFFFFF";
          context.fillText(String(x + ', ' + y + ', ' + z), 128, 128);
          let tile = canvas.toDataURL('image/png');
          tiles[String(x + '-' + y + '-' + z)] = tile;
        }
      }
    }

    this.setState({tiles: tiles});
  }

  render(){
    let initial_view_state = {longitude: 0, latitude: 0, zoom: 0};

    const layer = new TileLayer({
    getTileData: ({x, y, z}) => {
      let url = this.state.tiles[x+'-'+y+'-'+z]; //If requested tile x,y,z, return bitmap in tiles['x-y-z']
      return url;
    },
    minZoom: 0,
    maxZoom: maxDepth-1, //don't try to load tiles level which we didn't generate
    tileSize: 256,

    renderSubLayers: props => {
      const {
        bbox: {west, south, east, north}
      } = props.tile;

      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [west, south, east, north]
      });
    }
  });


    return(
      <div>
      <DeckGL
      initialViewState={initial_view_state}
      controller={true}
      layers={[layer]} >
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
    <ImageMap/>
    </div>
  );
}

export default App;
