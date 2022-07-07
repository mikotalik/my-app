import './App.css';
import React from "react";
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { MapView } from "@deck.gl/core"
import { FirstPersonView } from "@deck.gl/core"
import { Deck } from "@deck.gl/core"
import { StaticMap } from 'react-map-gl';
import { GeoImage } from 'geolib';
import { CogTiff } from '@cogeotiff/core';
import { SourceHttp } from '@chunkd/source-http';

//import { compress, decompress } from 'lzw-compressor';
//const lzw = require('lzw');
//import lzwCompress from 'lzwcompress';
const pako = require('pako');
const jpeg = require('jpeg-js');

//const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoiam9ldmVjeiIsImEiOiJja3lpcms5N3ExZTAzMm5wbWRkeWFuNTA3In0.dHgiiwOgD-f7gD7qP084rg';

//let baseurl = 'https://s3.waw2-1.cloudferro.com/swift/v1/AUTH_b33f63f311844f2fbf62c5741ff0f734/ewoc-prd/';
//let url = baseurl + '20HMD/2019_winter/2019_winter_41226_cereals_confidence_20HMD.tif';
//let url = 'https://oin-hotosm.s3.amazonaws.com/56f9b5a963ebf4bc00074e70/0/56f9c2d42b67227a79b4faec.tif';

class ImageMap extends React.Component {
  //url = "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/2020/S2A_36QWD_20200701_0_L2A/TCI.tif";
  url = 'https://oin-hotosm.s3.amazonaws.com/56f9b5a963ebf4bc00074e70/0/56f9c2d42b67227a79b4faec.tif';
  src;
  geo;
  cog;
  img;
  tiles = []
  preloadLayers = false;

  constructor(props) {
    super(props);
    this.state = { tileSize: 512, zoomOffset: 0, depth: 0};
  }

  async initImage(address) {
    this.src = new SourceHttp(address);
    this.cog = await CogTiff.create(this.src);
    console.log("Initializing ");
    console.log(this.cog);
    this.geo = new GeoImage();
    this.geo.setAutoRange(false);
    //this.geo.setDataRange(128,0);
    //this.geo.setDataClip(0,254);
    this.geo.setOpacity(200);
  }

  async initLayer(z) {
    this.img = await this.cog.getImage(z);
    //this.img.loadGeoTiffTags()
    //this.state.extent = this.img.bbox;
    //console.log(this.img.epsg)
  }

  async preloadTiles() {
    console.log("Preloading tiles...")
    for (let z = 0; z < this.cog.images.length; z++) {
      await this.initLayer(z);

      const tileWidth = this.img.tileSize.width;
      const tilesX = this.img.tileCount.x;
      const tilesY = this.img.tileCount.y;

      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          //console.log("starting preload of tile...")
          let decompressed;

          if (x >= tilesX || y >= tilesY) {
            decompressed = new Image(tileWidth, tileWidth);
          } else {
            const tile = await this.img.getTile(x, y);
            const data = await tile.bytes;

            if (this.img.compression === "image/jpeg") {
              decompressed = await jpeg.decode(data, { useTArray: true });
            } else if (this.img.compression === "application/deflate") {
              decompressed = await this.geo.getBitmap({ rasters: [decompressed], width: tileWidth, height: tileWidth });
            }
          }

          this.tiles[x + "," + y + "," + z] = decompressed;
          console.log("tile " + x + "," + y + "," + z + " preloaded")
        }
      }
      console.log("layer " + z + " loaded");
    }
  }

  async getTileAt(x, y, z) {

    if (this.img.id !== z) {
      await this.initLayer(z);
    }

    const tileWidth = this.img.tileSize.width;
    const tilesX = this.img.tileCount.x;
    const tilesY = this.img.tileCount.y;

    let decompressed;

    if (x >= tilesX || y >= tilesY) {
      decompressed = new Image(tileWidth, tileWidth);
    } else {
      const tile = await this.img.getTile(x, y);
      const data = tile.bytes;

      if (this.img.compression === "image/jpeg") {
        decompressed = await jpeg.decode(data, { useTArray: true });
      } else if (this.img.compression === "application/deflate") {
        decompressed = await pako.inflate(data);
        decompressed = await this.geo.getBitmap({ rasters: [decompressed], width: tileWidth, height: tileWidth });
      }
    }

    return new Promise(function (resolve, reject) {
      resolve(decompressed);
      reject("Cannot retrieve tile ");
    });
  }

  async componentDidMount() {
    console.clear();
    await this.initImage(this.url);
    const imageCount = this.cog.images.length;
    await this.initLayer(imageCount - 1);
    console.log("img initialized");

    if(this.preloadLayers === true){
      await this.preloadTiles();
    }
    this.setState({depth: imageCount, tileSize: this.img.tileSize.width})
  }

  render() {
    let initial_view_state = { longitude: 0, latitude: 0, zoom: 0 };

    const layer = new TileLayer({
      getTileData: ({ x, y, z }) => {
        let image;
        
        if (this.preloadLayers === true) {
          const address = String(x + "," + y + "," + String(this.cog.images.length - z))
          image = this.tiles[address]
          console.log("grabbing tile from array: " + address);
        } else {
          image = this.getTileAt(x, y, this.cog.images.length - z);
        }
        return image;
      },

      //minZoom: 3,
      maxZoom: this.state.depth, //don't try to load tiles level we didn't generate
      zoomOffset: this.state.zoomOffset,
      tileSize: this.state.tileSize,
      maxRequests: 5,
      refinementStrategy: 'best-available',
      //extent: this.state.extent,

      renderSubLayers: props => {
        const {
          bbox: { west, south, east, north }
        } = props.tile;

        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north],

        });
      }
    });


    return (
      <div>
        <DeckGL
          initialViewState={initial_view_state}
          controller={true}
          layers={[layer]} >
          <MapView id="map" width="100%" height="100%" top="100px" controller={true}>

          </MapView>
        </DeckGL>
      </div>
    );
  }
}
//<StaticMap mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN} />


function App() {

  return (
    <div className="App">
      <h1> DECK.GL GEOTIFF TEST </h1>
      <ImageMap />
    </div>
  );
}

export default App;
