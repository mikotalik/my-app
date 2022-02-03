import React from 'react';
import './App.css';
import { readRasterFromURL } from 'fast-geotiff'
//import

console.log("starting...")
const imageData = readRasterFromURL('nasa.tif')

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
      <Map text={"Here will be a map"}/>
    </div>
  );
}

export default App;
