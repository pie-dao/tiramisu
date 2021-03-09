# Tiramisu

<img src="https://cdn.dribbble.com/users/1104799/screenshots/3374182/tiramisu_d_2x.png?compress=1&resize=400x300" />


## Install
```
yarn
yarn build
```


## Usage
```
Usage: index [options]

Options:
  -d, --debug              output extra debugging
  --folder <path>          path to save data (default: "./data")
  -h, --hydratate          should hydratate
  -c, --cache              should use cache
  -p, --plot               should plot
  --maxweight <number>     max weight allowed: 0.1 = 10%
  --optimize <number>      attempts to find a better sharpe ratio
  --no-adjusted-weight     skips adjusted weight computation
  --no-sentiment-weight    skips sentiment weight computation
  --no-save-json           skips sentiment weight computation
  -n, --name <name>        name of allocation (required)
  -a, --allocation <path>  path to allocation (required)
  --help                   display help for command

yarn start -a mypie.json -n mypie -p
```

## Allocation Json Example
```
[
   {
      "name":"MANA",
      "coingeckoId":"decentraland",
      "sentimentScore":48
   },
   {
      "name":"ENJ",
      "coingeckoId":"enjincoin",
      "sentimentScore":52
   },
   {
      "name":"RFOX",
      "coingeckoId":"redfox-labs-2",
      "sentimentScore":45
   },
   {
      "name":"SAND",
      "coingeckoId":"the-sandbox",
      "sentimentScore":44
   },
   {
      "name":"AXS",
      "coingeckoId":"axie-infinity",
      "sentimentScore":43
   },
   {
      "name":"MUST",
      "coingeckoId":"must",
      "sentimentScore":46
   },
   {
      "name":"ATRI",
      "coingeckoId":"atari",
      "sentimentScore":41
   },
   {
      "name":"GHST",
      "coingeckoId":"aavegotchi",
      "sentimentScore":48
   },
   {
      "name":"ULTRA",
      "coingeckoId":"ultra",
      "sentimentScore":41
   },
   {
      "name":"FUN",
      "coingeckoId":"funfair",
      "sentimentScore":38
   }
]
```
