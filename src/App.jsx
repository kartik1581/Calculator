import React, { useState } from 'react';

const App = () => {
  const [formData, setFormData] = useState({
    instrumentType: 'options',
    symbol: 'NIFTY',
    expiryDate: '26-Sep-2025',
    strikePrice: 24900,
    entryPrice: 0,
    exitPrice: 0,
    quantity: 1,
    lotSize: 50,
    profitTaxRate: 30,
    tradeType: 'long', // 'long' for buy then sell, 'short' for sell then buy
    initialMarginRate: 10, // Default 10% for futures/short options
    exposureMarginRate: 5,  // Default 5% for futures/short options
  });

  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [inputError, setInputError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const fetchCurrentPrice = () => {
    setIsLoading(true);
    setFetchError(null);
    setTimeout(() => {
      try {
        const basePrice = 150.50 + formData.strikePrice / 1000;
        const randomFluctuation = (Math.random() - 0.5) * 10;
        const fetchedPrice = basePrice + randomFluctuation;
        setFormData(prevData => ({
          ...prevData,
          entryPrice: fetchedPrice.toFixed(2)
        }));
      } catch (error) {
        setFetchError("Failed to fetch price. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }, 1500);
  };

  const calculateFnoCosts = (type, price, quantity, lotSize, instrumentType) => {
    const BROKERAGE_PER_ORDER = 20.0;
    const GST_RATE = 0.18;
    const SEBI_TURNOVER_FEE = 0.000001;
    let totalCost = 0;
    let turnover = 0;
    let brokerage = BROKERAGE_PER_ORDER;
    let sebiCharge = 0;
    let exchangeCharge = 0;
    let stt = 0;
    let stampDuty = 0;

    turnover = parseFloat(price) * parseInt(quantity, 10) * parseInt(lotSize, 10);
    sebiCharge = turnover * SEBI_TURNOVER_FEE;

    if (instrumentType === 'options') {
      if (type === 'buy') {
        stampDuty = turnover * 0.00003;
      } else if (type === 'sell') {
        stt = turnover * 0.001;
      }
      exchangeCharge = turnover * 0.0003503;
    } else if (instrumentType === 'futures') {
      if (type === 'buy') {
        stampDuty = turnover * 0.00002;
      } else if (type === 'sell') {
        stt = turnover * 0.0002;
      }
      exchangeCharge = turnover * 0.000173;
    }
    
    const gst = (brokerage + exchangeCharge + sebiCharge) * GST_RATE;
    totalCost = brokerage + stt + exchangeCharge + sebiCharge + gst + stampDuty;

    return {
      turnover: turnover,
      brokerage: brokerage,
      exchangeCharge: exchangeCharge,
      sebiCharge: sebiCharge,
      gst: gst,
      stt: stt,
      stampDuty: stampDuty,
      totalCost: totalCost,
    };
  };
  
  const calculateMargin = (instrumentType, tradeType, entryPrice, quantity, lotSize, initialMarginRate, exposureMarginRate) => {
    const totalTurnover = parseFloat(entryPrice) * parseInt(quantity, 10) * parseInt(lotSize, 10);
    if (instrumentType === 'options' && tradeType === 'long') {
      // For long options, margin is the premium paid
      return { total: totalTurnover, initial: totalTurnover, exposure: 0 };
    } else if (instrumentType === 'options' && tradeType === 'short') {
      // For short options, margin is based on a percentage of turnover
      const initial = totalTurnover * (parseFloat(initialMarginRate) / 100);
      const exposure = totalTurnover * (parseFloat(exposureMarginRate) / 100);
      return { total: initial + exposure, initial, exposure };
    } else if (instrumentType === 'futures') {
      // For futures, margin is based on a percentage of turnover
      const initial = totalTurnover * (parseFloat(initialMarginRate) / 100);
      const exposure = totalTurnover * (parseFloat(exposureMarginRate) / 100);
      return { total: initial + exposure, initial, exposure };
    }
    return { total: 0, initial: 0, exposure: 0 };
  };

  const calculateNetProfit = () => {
    const { instrumentType, entryPrice, exitPrice, quantity, lotSize, profitTaxRate, tradeType, initialMarginRate, exposureMarginRate } = formData;
    const totalLots = parseInt(quantity, 10);
    const totalUnits = totalLots * parseInt(lotSize, 10);
    const entry = parseFloat(entryPrice);
    const exit = parseFloat(exitPrice);

    if (entry <= 0 || exit <= 0 || totalLots <= 0 || totalUnits <= 0) {
      setInputError("Please enter valid prices and quantities.");
      return;
    } else {
      setInputError(null);
    }

    const buyCosts = (tradeType === 'long') ? calculateFnoCosts('buy', entry, totalLots, lotSize, instrumentType) : calculateFnoCosts('buy', exit, totalLots, lotSize, instrumentType);
    const sellCosts = (tradeType === 'long') ? calculateFnoCosts('sell', exit, totalLots, lotSize, instrumentType) : calculateFnoCosts('sell', entry, totalLots, lotSize, instrumentType);

    const grossProfitLoss = (tradeType === 'long') ? (exit - entry) * totalUnits : (entry - exit) * totalUnits;
    const totalCharges = buyCosts.totalCost + sellCosts.totalCost;
    const netProfitBeforeTax = grossProfitLoss - totalCharges;
    const requiredMargin = calculateMargin(instrumentType, tradeType, entry, totalLots, lotSize, initialMarginRate, exposureMarginRate);

    let taxOnProfit = 0;
    if (netProfitBeforeTax > 0) {
      taxOnProfit = netProfitBeforeTax * (parseFloat(profitTaxRate) / 100);
    }
    const finalNetProfit = netProfitBeforeTax - taxOnProfit;

    setResults({
      buyCosts: buyCosts,
      sellCosts: sellCosts,
      grossProfitLoss: grossProfitLoss,
      totalCharges: totalCharges,
      netProfitBeforeTax: netProfitBeforeTax,
      taxOnProfit: taxOnProfit,
      finalNetProfit: finalNetProfit,
      requiredMargin: requiredMargin,
    });
  };

  const formatCurrency = (value) => `₹${value.toFixed(2)}`;

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 p-8 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-8 shadow-2xl">
        <h1 className="text-4xl font-extrabold text-center text-teal-400 mb-6">
          NSE Options & Futures Cost Calculator
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Calculate your total costs and net profit for a trade on the NSE.
        </p>

        <div className="space-y-6">
          <div>
            <label htmlFor="instrumentType" className="block text-gray-300 font-semibold mb-2">Instrument Type</label>
            <select
              id="instrumentType"
              name="instrumentType"
              value={formData.instrumentType}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="options">Options</option>
              <option value="futures">Futures</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label htmlFor="symbol" className="block text-gray-300 font-semibold mb-2">Symbol</label>
              <input
                type="text"
                id="symbol"
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor="expiryDate" className="block text-gray-300 font-semibold mb-2">Expiry Date</label>
              <input
                type="text"
                id="expiryDate"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor="strikePrice" className="block text-gray-300 font-semibold mb-2">Strike Price</label>
              <input
                type="number"
                id="strikePrice"
                name="strikePrice"
                value={formData.strikePrice}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                min="0"
              />
            </div>
          </div>
          
          <div className="relative">
            <label htmlFor="entryPrice" className="block text-gray-300 font-semibold mb-2">Entry Price (Premium)</label>
            <input
              type="number"
              id="entryPrice"
              name="entryPrice"
              value={formData.entryPrice}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 pr-32"
              min="0"
              disabled={isLoading}
            />
            <button
              onClick={fetchCurrentPrice}
              className="absolute right-0 top-7 mt-1 mr-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm disabled:bg-gray-500"
              disabled={isLoading}
            >
              {isLoading ? 'Fetching...' : 'Fetch Price'}
            </button>
          </div>

          <div>
            <label htmlFor="exitPrice" className="block text-gray-300 font-semibold mb-2">Exit Price (Premium)</label>
            <input
              type="number"
              id="exitPrice"
              name="exitPrice"
              value={formData.exitPrice}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              min="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="quantity" className="block text-gray-300 font-semibold mb-2">Quantity (Lots)</label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                min="1"
              />
            </div>
            <div>
              <label htmlFor="lotSize" className="block text-gray-300 font-semibold mb-2">Lot Size</label>
              <input
                type="number"
                id="lotSize"
                name="lotSize"
                value={formData.lotSize}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                min="1"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="tradeType" className="block text-gray-300 font-semibold mb-2">Trade Type</label>
            <select
              id="tradeType"
              name="tradeType"
              value={formData.tradeType}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="long">Long (Buy then Sell)</option>
              <option value="short">Short (Sell then Buy)</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="profitTaxRate" className="block text-gray-300 font-semibold mb-2">Profit Tax Rate (%)</label>
            <input
              type="number"
              id="profitTaxRate"
              name="profitTaxRate"
              value={formData.profitTaxRate}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              min="0"
              max="100"
            />
          </div>

          {(formData.instrumentType === 'futures' || (formData.instrumentType === 'options' && formData.tradeType === 'short')) && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="initialMarginRate" className="block text-gray-300 font-semibold mb-2">
                  Initial Margin Rate (%)
                  <span className="text-gray-400 text-xs ml-2">(on Turnover)</span>
                </label>
                <input
                  type="number"
                  id="initialMarginRate"
                  name="initialMarginRate"
                  value={formData.initialMarginRate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label htmlFor="exposureMarginRate" className="block text-gray-300 font-semibold mb-2">
                  Exposure Margin Rate (%)
                  <span className="text-gray-400 text-xs ml-2">(on Turnover)</span>
                </label>
                <input
                  type="number"
                  id="exposureMarginRate"
                  name="exposureMarginRate"
                  value={formData.exposureMarginRate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          )}

          <button
            onClick={calculateNetProfit}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg transition duration-300 ease-in-out shadow-lg transform hover:scale-105"
          >
            Calculate Net Profit
          </button>
        </div>

        {inputError && (
          <div className="mt-4 text-center text-red-400">
            {inputError}
          </div>
        )}
        {fetchError && (
          <div className="mt-4 text-center text-red-400">
            {fetchError}
          </div>
        )}

        {results && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-center text-teal-400 mb-4">
              Results
            </h2>
            <div className="bg-gray-700 p-6 rounded-lg space-y-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-300">Required Margin</span>
                <span className="font-bold text-lg text-yellow-400">
                  {formatCurrency(results.requiredMargin.total)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-gray-400 text-sm pl-4">
                  <span>Initial Margin: {formatCurrency(results.requiredMargin.initial)}</span>
                  <span>Exposure Margin: {formatCurrency(results.requiredMargin.exposure)}</span>
              </div>
              <hr className="border-gray-600" />
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-300">Gross P&L</span>
                <span className="font-bold text-lg">{formatCurrency(results.grossProfitLoss)}</span>
              </div>
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-300">Total Charges</span>
                <span className="font-bold text-lg text-red-400">- {formatCurrency(results.totalCharges)}</span>
              </div>
              <hr className="border-gray-600" />
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-300">Net P&L before Tax</span>
                <span className={`font-bold text-lg ${results.netProfitBeforeTax > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(results.netProfitBeforeTax)}
                </span>
              </div>
              {results.netProfitBeforeTax > 0 && (
                <>
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-gray-300">Tax on Profit ({formData.profitTaxRate}%)</span>
                    <span className="font-bold text-lg text-red-400">- {formatCurrency(results.taxOnProfit)}</span>
                  </div>
                  <hr className="border-gray-600" />
                </>
              )}
              <div className="flex justify-between items-center text-2xl font-extrabold text-teal-400">
                <span>Final Net P&L</span>
                <span className={`${results.finalNetProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(results.finalNetProfit)}
                </span>
              </div>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg mt-6 shadow-inner">
              <h3 className="text-xl font-bold text-teal-400 mb-4">
                Detailed Charges
              </h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-300 font-bold">Buy-side costs (Turnover: {formatCurrency(results.buyCosts.turnover)})</p>
                <div className="grid grid-cols-2 gap-1 text-gray-400 pl-4">
                  <span>Brokerage: {formatCurrency(results.buyCosts.brokerage)}</span>
                  <span>GST: {formatCurrency(results.buyCosts.gst)}</span>
                  <span>Exchange Charge: {formatCurrency(results.buyCosts.exchangeCharge)}</span>
                  <span>SEBI Charge: {formatCurrency(results.buyCosts.sebiCharge)}</span>
                  <span>Stamp Duty: {formatCurrency(results.buyCosts.stampDuty)}</span>
                  <span>Total Buy Cost: {formatCurrency(results.buyCosts.totalCost)}</span>
                </div>
                <p className="text-gray-300 font-bold mt-4">Sell-side costs (Turnover: {formatCurrency(results.sellCosts.turnover)})</p>
                <div className="grid grid-cols-2 gap-1 text-gray-400 pl-4">
                  <span>Brokerage: {formatCurrency(results.sellCosts.brokerage)}</span>
                  <span>GST: {formatCurrency(results.sellCosts.gst)}</span>
                  <span>Exchange Charge: {formatCurrency(results.sellCosts.exchangeCharge)}</span>
                  <span>SEBI Charge: {formatCurrency(results.sellCosts.sebiCharge)}</span>
                  <span>STT: {formatCurrency(results.sellCosts.stt)}</span>
                  <span>Total Sell Cost: {formatCurrency(results.sellCosts.totalCost)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
