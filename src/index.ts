import 'dotenv/config';
import { readFileSync } from 'fs';
import { Command } from 'commander';
import { plot } from 'nodeplotlib';
import { IndexCalculator } from './classes/IndexCalculator';

const program = new Command();

program
  .option('-d, --debug', 'output extra debugging')
  .option('--folder <path>', 'path to save data', './data')
  .option('-h, --hydratate', 'should hydratate')
  .option('-c, --cache', 'should use cache')
  .option('-p, --plot', 'should plot')
  .option('--optimize <number>', 'attempts to find a better sharpe ration')
  .option('--no-adjusted-weight', 'skips adjusted weight computation')
  .option('--no-sentiment-weight', 'skips sentiment weight computation')
  .option('--no-save-json', 'skips sentiment weight computation')
  .requiredOption('-n, --name <name>', 'name of allocation (required)')
  .requiredOption('-a, --allocation <path>', 'path to allocation (required)')

program.parse(process.argv);
const options = program.opts();
const json = JSON.parse(readFileSync(options.allocation, 'utf-8'));

function plotAll(data) {
  /**
   * Returns
   */
  let traces: any = [{x: [], y: [], type: 'scatter', name: data.name}];

  data.performance.forEach((o, i) => {
    traces[0].y.push(o[1] * 100)
    traces[0].x.push(o[0])
  });

  data.dataSet.forEach( el =>  {
    let temp: any = {x: [], y: [], type: 'scatter', name: el.name};
    el.performance.forEach((o, i) => {
      temp.y.push(o[1] * 100)
      temp.x.push(o[0])
    });
    traces.push(temp);
  })
  
  plot(traces);

  /**
   * Market Cap in Bubbles
   */
  var desired_maximum_marker_size = 100;
  let size = data.dataSet.map(o => o.AVG_MCAP);
  var trace1: any = {
    x: data.dataSet.map(o => o.name),
    y: size,
    mode: 'markers',
    marker: {
      size: size,
      //set 'sizeref' to an 'ideal' size given by the formula sizeref = 2. * max(array_of_size_values) / (desired_maximum_marker_size ** 2)
      sizeref: 2.0 * Math.max(...size) / (desired_maximum_marker_size**2),
      sizemode: 'area'
    }
  };
  
  var datax = [trace1];
  plot(datax)
}

(async () => {
  let idx;
  const useCache = options.cache || false;

  if (options.debug) console.log(options);
  
  if(options.hydratate) {
    idx = json;
  } else {
    idx = new IndexCalculator(options.name, options.folder);
    await idx.pullData(useCache, json);
    idx.compute(options);
  }

  if(options.optimize) {
    let attempts = parseInt(options.optimize);
    if(attempts > 0) {
      idx.optimizeSharpe(attempts);
    } else {
      console.log('Optimize: needs to be positive int')
    }
    
  }

  if(options.plot) {
    plotAll(idx)
  }
})();