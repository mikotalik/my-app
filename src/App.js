import React from 'react';
import './App.css';
import UTIF from 'utif'


console.log("starting")

const url = "park.tif";

//const tiff = await fromUrl("https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg_geo.tif");

function imgLoaded(e) {
  console.log(e.target.response);
  var ifds = UTIF.decode(e.target.response);
  console.log(ifds);
  UTIF.decodeImage(e.target.response, ifds[0]);
  var rgba  = UTIF.toRGBA8(ifds[0]);  // Uint8Array with RGBA pixels
  console.log(ifds[0].width, ifds[0].height, ifds[0]);
}

var xhr = new XMLHttpRequest();
xhr.open("GET", url);
xhr.responseType = "arraybuffer";
xhr.onload = imgLoaded;   xhr.send();

//const imageData = readRasterFromURL('park.tif')

class Map extends React.Component{
  constructor(props){
    super(props);
    //this.state = {text : props.text};
  }

  render(){
    return(
      <div className="map">
      <h2> {this.props.text} </h2>
      </div>
    );
  }
}


function App() {

  return (
    <div className="App">
    <h1> Testing the Geotiff import </h1>
    <Map text={"Here will be some map"}/>
    </div>
  );
}

export default App;
