import 'dotenv/config';
import { readFileSync } from 'fs';
import { Command } from 'commander';
import { IndexCalculator } from './classes/IndexCalculator';


const program = new Command();

program
  .option('--folder <path>', 'path to save data', './data')
  .requiredOption('-n, --name <name>', 'name of allocation (required)')
  .requiredOption('-a, --allocation <path>', 'path to allocation (required)')

program.parse(process.argv);
const options = program.opts();
const json = JSON.parse(readFileSync(options.allocation, 'utf-8'));


console.log(`- ${options.allocation}`, json);

(async () => {
  let idx = new IndexCalculator(options.name, options.folder);
  await idx.pullData(false, json);
  idx.compute();
})();