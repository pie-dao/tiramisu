const fs = require('fs')
const path = require('path');
const CoinGecko = require('coingecko-api');
var { jStat } = require('jstat');

import * as _ from 'lodash';
import BigNumber from "bignumber.js";

BigNumber.set({ DECIMAL_PLACES: 10, ROUNDING_MODE: 4 })

// if you need 3 digits, replace 1e2 with 1e3 etc.
// or just copypaste this function to your code:
const round = (num, digits=4, base = 10) => {
    return +(Math.round(+(num + `e+${digits}`))  + `e-${digits}`);

    // Method 1
    // let scaling = 10 ** digits;
    // return Math.round((num + Number.EPSILON) * scaling) / scaling;

    // Method 2
    //return num.toFixed(digits) * 1;
    //return +num.toFixed(digits);

    // Method 3
    // var pow = Math.pow(base, digits);
    // return Math.round(num*pow) / pow;
}

const getDot = (arrA, arrB, row, col) => {
    return arrA[row].map((val, i) => (val * arrB[i][col]))
  .reduce((valA, valB) => valA + valB);
}

const multiplyMatricies = (a, b) => {
    let matrixShape = new Array(a.length).fill(0)
      .map(() => new Array(b[0].length).fill(0));
        return matrixShape.map((row, i) =>
          row.map((val, j) => getDot(a, b, i, j)));
      }

const randomIntFromInterval = (min, max) => { 
    return Math.random() * (max - min + 1) + min;
}

export class IndexCalculator {

    public dataSet: Array<any>;
    public performance: Array<any>;
    public name: string;
    public SHARPERATIO: number;
    public cumulativeUnderlyingMCAP: number;
    public VARIANCE: number;
    public STDEV: number;
    private maxWeight: number;
    private indexStartingNAV: number; // Calculated in USD
    private sentimentWeightInfluence: number;
    private marketWeightInfluence: number;
    private _api: any;
    private path: string;

    constructor(name, path, maxweight="1", sentimentWeight="0.2") {
        this.path = process.cwd() + '/' + path;
        this.dataSet = [];
        this.maxWeight = parseFloat(maxweight);
        this.name = name;
        this.performance = [];
        this.indexStartingNAV = 1;
        this.sentimentWeightInfluence = parseFloat(sentimentWeight);
        this.marketWeightInfluence = 1 - this.sentimentWeightInfluence;

        console.log('marketWeightInfluence', this.marketWeightInfluence)
        this._api = new CoinGecko();
    }

    async fetchCoinData(id) {
        return this._api.coins.fetchMarketChart(id, {
            days: 30,
            interval: 'daily'
        });
    }

    async pullData(useSnapshot=false, tokens) {
        for (const token of tokens) {
            
            let jsonSnapshot;
            let hasSnapshot = false;

            try {
                if(useSnapshot) {
                    jsonSnapshot = await require(path.resolve(this.path, `coins/${token.coingeckoId}.json`));
                    hasSnapshot = true;
                }
            } catch(e) {
                console.log('No cached data for: ', token.coingeckoId);
            }

            if(hasSnapshot) {
                this.dataSet.push({...jsonSnapshot, ...token})
                continue;
            } 
            console.log(`Fetchin ${token.coingeckoId} ...`)
            let response: any = await this.fetchCoinData(token.coingeckoId);
            let coin = {
                ...token,
                backtesting: {},
                data: response.data
            };
            this.dataSet.push(coin)

            let data = JSON.stringify(coin);
            fs.mkdirSync(this.path + '/coins/', { recursive: true })
            fs.writeFileSync(path.resolve(this.path, `coins/${token.coingeckoId}.json`), data);
        }
    }

    computeMCAP() {
        this.dataSet.forEach(el => {
            
            let marketCap = el.data.market_caps.map( o => {
                // o[0] Timestamp
                // o[1] Value
                return o[1];
            })
            el.MIN_MCAP = Math.min(...marketCap);
            el.MAX_MCAP = Math.max(...marketCap);
            el.AVG_MCAP = marketCap.reduce((a,b) => a + b, 0) / marketCap.length;
        })

        this.cumulativeUnderlyingMCAP = this.dataSet.reduce((a,b) => a + b.AVG_MCAP, 0);
    }

    computeWeights() {
        this.dataSet.forEach(el => {
            //Readeble: el.RATIO = el.AVG_MCAP / this.cumulativeUnderlyingMCAP;
            el.originalRATIO =( (new BigNumber(el.AVG_MCAP)).dividedBy( new BigNumber(this.cumulativeUnderlyingMCAP)) ).toNumber();
            el.RATIO = el.originalRATIO;
        });
    }

    getTotal() {
        let total = this.dataSet.reduce((a, v) => a+v.RATIO, 0 );
        console.log(`\nTotal: ${round(total)}\n`)
        return total;
    }

    computeAdjustedWeights(counter=0) {
        let totalLeftover = 0;
        let leftoverMCAP = 0;

        this.dataSet.forEach(el => {
            if(el.RATIO > this.maxWeight) {
                el.cappedRATIO = this.maxWeight;
                el.leftover = el.RATIO - this.maxWeight;
                el.RATIO = this.maxWeight;
                el.CAPPED = true;
                el.ADJUSTED = false;
                totalLeftover += el.leftover;
            } else {
                el.CAPPED = false;
                el.ADJUSTED = true;
                leftoverMCAP += el.AVG_MCAP;
            }
        });

        let ratio = false;
        this.dataSet.forEach(el => {
            if(el.ADJUSTED) {
                // el.relativeToLeftoverRATIO = el.AVG_MCAP / leftoverMCAP;

                el.relativeToLeftoverRATIO = (new BigNumber(el.AVG_MCAP)).dividedBy( new BigNumber(leftoverMCAP) );

                //el.adjustedMarketCAP = el.relativeToLeftoverRATIO * totalLeftover * this.cumulativeUnderlyingMCAP;
                el.adjustedMarketCAP = el.relativeToLeftoverRATIO.multipliedBy( new BigNumber(totalLeftover) ).multipliedBy( new BigNumber(this.cumulativeUnderlyingMCAP) );
                
                //el.addedRatio = el.adjustedMarketCAP / this.cumulativeUnderlyingMCAP;
                el.addedRatio = el.adjustedMarketCAP.dividedBy( new BigNumber(this.cumulativeUnderlyingMCAP) )                

                //el.adjustedRATIO = el.originalRATIO + el.addedRatio;
                el.adjustedRATIO = new BigNumber( el.RATIO ).plus(el.addedRatio);

                if(counter > 10)
                    el.RATIO = el.adjustedRATIO.toNumber() > this.maxWeight ? this.maxWeight : el.adjustedRATIO.toNumber();
                else
                    el.RATIO = el.adjustedRATIO.toNumber();
            }

            if(el.RATIO > this.maxWeight){
                ratio = true;
            }
        });

        // this.dataSet.forEach(el => {
        //     console.log(`${el.name}: ${(el.RATIO*100).toFixed(2)}%`)
        // });
        
        if(ratio){
            this.getTotal();
            // console.log('Calling it again')
            // console.log('---------------------')
            // console.log('\n\n')
            this.computeAdjustedWeights(counter+1);
        }
    }

    getTokenLastPrice(el) {
        return parseFloat( _.last(el.data.prices)[1] );
    }

    computeSentimentWeight() {
        console.log('computeSentimentWeight');
        let total = 0;
        this.dataSet.forEach(el => {
            total += el.sentimentScore;
        });

        // Calculate Sentiment Weight
        this.dataSet.forEach(el => {
            el.sentimentRATIO = el.sentimentScore/total;
        });

        console.log('computeSentimentWeight');

        // Calculate OverAllWeight
        this.dataSet.forEach(el => {
            el.finalWEIGHT = round( ( el.RATIO * this.marketWeightInfluence ) + (el.sentimentRATIO * this.sentimentWeightInfluence), 4);
            console.log('el.finalWEIGHT', el.finalWEIGHT);
            el.RATIO = el.finalWEIGHT;
        });

    }

    computeTokenNumbers() {
        this.dataSet.forEach(el => {
            el.tokenBalance = this.indexStartingNAV * el.RATIO * this.getTokenLastPrice(el);
        });
    }

    computeBacktesting() {
        this.dataSet.forEach(el => {
            
            // let prices = el.data.prices.map( o => {
            //     // o[0] Timestamp
            //     // o[1] Value
            //     return o[1];
            // });


            // o[0] Timestamp
            // o[1] Value
            // o[2] ln(price/prev prive)
            for (let i = 0; i < el.data.prices.length; i++) {
                const price = el.data.prices[i][1];

                if( i === 0) {
                    el.data.prices[i].push(0);
                } else {
                    let prePrice = el.data.prices[i-1][1]
                    let ln = Math.log( price /  prePrice)
                    el.data.prices[i].push( ln );
                }
            }
        })

        this.dataSet.forEach(el => {
            let logs = el.data.prices.map( o => {
                return o[2];
            });
            
            //Passing true indicates to compute the sample variance.
            el.VARIANCE = jStat.variance(logs, true) * logs.length;
            el.STDEV = Math.sqrt(el.VARIANCE);
            el.backtesting.returns = logs;
        })
    }

    computeCorrelation() {
        for (let i = 0; i < this.dataSet.length; i++) {
            const current = this.dataSet[i];
            for (let k = 0; k < this.dataSet.length; k++) {
                const next = this.dataSet[k];
                let correlation = jStat.corrcoeff(current.backtesting.returns, next.backtesting.returns);
                _.set(current.backtesting, `correlation.${next.name}`, correlation);
            }
        }
    }

    computeCovariance() {

        let matrixC = [];
        let matrixB = [];

        for (let i = 0; i < this.dataSet.length; i++) {
            const current = this.dataSet[i];
            let arr = [];
            for (let k = 0; k < this.dataSet.length; k++) {
                const next = this.dataSet[k];
                let covariance = jStat.covariance(current.backtesting.returns, next.backtesting.returns) * current.backtesting.returns.length;
                _.set(current.backtesting, `covariance.${next.name}`, covariance);
                arr.push(covariance);
            }
            matrixB.push(arr)
        }
        
        //Needs documentation, ask Gab
        let weightsArray = this.dataSet.map( el => el.RATIO);
        weightsArray.forEach(el => matrixC.push([el]));

        let product = multiplyMatricies([ weightsArray ] , matrixB);
        const pieVariance = multiplyMatricies(product, matrixC)[0][0];

        this.VARIANCE = pieVariance;
        this.STDEV = Math.sqrt(pieVariance);
    }

    computeMCTR() {
        let totalContributionGlobal = 0;

        //Calculate first the single marginalContribution
        for (let i = 0; i < this.dataSet.length; i++) {
            const current = this.dataSet[i];
            let tempCalc = 0;
            
            for (let k = 0; k < this.dataSet.length; k++) {
                const next = this.dataSet[k];

                let x = next.RATIO * current.STDEV * next.STDEV * current.backtesting.correlation[next.name];
                tempCalc += x;
            }

            current.marginalContribution = tempCalc * (1/this.STDEV);
            current.totalContribution = current.marginalContribution * current.RATIO;
            totalContributionGlobal += current.totalContribution;
        }

        //Then calculate MCTR based on the sum of the total contribution
        for (let i = 0; i < this.dataSet.length; i++) {
            const current = this.dataSet[i];
            current.MCTR = current.totalContribution / totalContributionGlobal;
        }
    }

    computePerformance() {
        //Calculate first the performance of the single coin
        for (let i = 0; i < this.dataSet.length; i++) {
            const el = this.dataSet[i];
            el.performance = [];
            
            // o[0] Timestamp
            // o[1] Value
            // o[2] ln(price/prev prive)
            for (let i = 0; i < el.data.prices.length; i++) {
                const timestamp = el.data.prices[i][0];
                const price = el.data.prices[i][1];
                if(i === 0) {
                    el.performance.push([timestamp, 0])
                    continue;
                }

                const timestampYesterday = el.data.prices[i-1][0];
                const priceYesterday = el.data.prices[0][1];
                const performance = (price - priceYesterday) / priceYesterday;

                el.performance.push([timestampYesterday, performance])
            }
        }

        this.performance = [];
        //Calculate the performance of the index
        for (let i = 0; i < this.dataSet[0].data.prices.length; i++) {
            const timestamp = this.dataSet[0].data.prices[i][0];
            let tempCalc = 0;
            
            for (let k = 0; k < this.dataSet.length; k++) {
                const coin = this.dataSet[k];
                if(coin.performance[i])
                    tempCalc += coin.RATIO * coin.performance[i][1];
            }

            this.performance.push([timestamp, tempCalc]);
        }
    }

    computeSharpeRatio() {
        this.SHARPERATIO = _.last(this.performance)[1] / this.STDEV;
    }

    async exportCSV() {

        let pricesAll = '';
        let mcapAll = '';
        let performance = '';
        for (let i = 0; i < this.dataSet.length; i++) {
            const el = this.dataSet[i];

            pricesAll += el.name + ',';
            mcapAll += el.name + ',';

            let prices = el.data.prices.map(o => {
                return o[1]
            })

            let mcaps = el.data.market_caps.map(o => {
                return o[1]
            })

            pricesAll += prices+'\n';
            mcapAll += mcaps+'\n';   
        }

        fs.mkdirSync(this.path + '/csv/', { recursive: true })
        fs.writeFileSync(path.resolve(this.path, `csv/prices.csv`), pricesAll);
        fs.writeFileSync(path.resolve(this.path, `csv/mcaps.csv`), mcapAll);

        performance += this.performance.map(o => {
            return o[0]
        }).join() 

        performance += '\n';

        performance += this.performance.map(o => {
            return o[1]
        }).join() 

        fs.writeFileSync(path.resolve(this.path, `csv/${this.name}-performance.csv`), performance);

    }

    saveModel() {

        this.getTotal();
        let data = JSON.stringify(this);
        fs.mkdirSync(this.path + '/pies/', { recursive: true })
        fs.writeFileSync(path.resolve(this.path, `pies/${this.name}-${this.performance[0][0]}-${this.performance[this.performance.length-1][0]}.json`), data);


        this.dataSet.forEach(el => {
            console.log(`${el.name}: ${(el.RATIO*100).toFixed(2)}%`)
        });

        console.log('SharpeRatio', this.SHARPERATIO);
        console.log('Performance', this.performance[this.performance.length-1][1]);

        this.exportCSV();
    }

    compute({ adjustedWeight, sentimentweight, saveJson }) {
        this.computeMCAP();
        this.computeWeights();
        if(adjustedWeight) this.computeAdjustedWeights();
        if(sentimentweight) this.computeSentimentWeight();
        this.computeBacktesting();
        this.computeCorrelation();
        this.computeCovariance();
        this.computeMCTR();
        this.computePerformance();
        this.computeTokenNumbers();
        this.computeSharpeRatio();
        if(saveJson) this.saveModel();
    }

    optimizeSharpe(attempts=100) {
        let SR = this.SHARPERATIO;
        let bestComb;
        //1.4824712878285808
        for (let index = 0; index < attempts; index++) {
            this.randomizeValues();
            this.computeBacktesting();
            this.computeCorrelation();
            this.computeCovariance();
            this.computeMCTR();
            this.computePerformance();
            this.computeTokenNumbers();
            this.computeSharpeRatio();
            if( this.SHARPERATIO > SR) {
                SR = this.SHARPERATIO;
                bestComb = [...this.dataSet];
                console.log( `\n${index}: Prev; ${SR}  /   Now: ${this.SHARPERATIO}\n`);
                bestComb.forEach(el => {
                    console.log(`${el.name}: ${(el.RATIO)}`)
                });
            }
        }

        console.log(`\n\nBest SR: ${SR}\n\n`)
        bestComb.forEach(el => {
            console.log(`${el.name}: ${(el.RATIO*100).toFixed(2)}%`)
        });

        let data = JSON.stringify(this);
        fs.mkdirSync(this.path + '/pies/', { recursive: true })
        fs.writeFileSync(path.resolve(this.path, `pies/${this.name}-${this.performance[0][0]}-${this.performance[this.performance.length-1][0]}-SR-Optimized.json`), data);

        console.log('Saved at: ', path.resolve(this.path, `pies/${this.name}-${this.performance[0][0]}-${this.performance[this.performance.length-1][0]}-SR-Optimized.json`))
    }

    randomizeValues() {
        let sample = [];
        let sample2 = [];
        const reducer = (accumulator, currentValue) => accumulator + currentValue;

        for (let index = 0; index < this.dataSet.length; index++) {
            sample.push( randomIntFromInterval(0.02, 0.2) );
        }
        
        let sum = sample.reduce(reducer);
        sample.forEach( e => {
            sample2.push( e/sum*100 )
        })

        for (let index = 0; index < this.dataSet.length; index++) {
            this.dataSet[index].RATIO = sample2[index] / 100;
        }
    }

}