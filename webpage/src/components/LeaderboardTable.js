import React, { useState, useEffect } from 'react';
import { useTable, useSortBy } from 'react-table';
import ReactCountryFlag from "react-country-flag";
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import CitationBox from './CitationBox';
import Footer from './Footer';
import { modelList, llmCountryMap } from './modelConfig';
import './LeaderboardTable.css';

const LeaderboardTable = () => {
  const [data, setData] = useState([]);
  const [bugCounts, setBugCounts] = useState({});
  const [showExtraColumns, setShowExtraColumns] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const benchmarks = ['defects4j', 'gitbugjava'];
    const metrics = ['exact_match@1', 'ast_match@1', 'plausible@1', 'cost'];
    let newBugCounts = {};
    let totalBugs = 0;

    const results = await Promise.all(modelList.map(async ([llm_name, strategy, provider]) => {
      const row = { name: llm_name, provider, total_cost: null, hasTotalData: false, release_date: null };

      try {
        const totalResponse = await fetch(`./results/${llm_name}/total.json`);
        const totalResult = await totalResponse.json();
        row['total_ast_match@1'] = totalResult['ast_match@1'];
        row['total_plausible@1'] = totalResult['plausible@1'];
        row.hasTotalData = true;
      } catch (error) {
        console.error(`Failed to load total.json for ${llm_name}:`, error);
      }

      let allBenchmarksComplete = true;
      await Promise.all(benchmarks.map(async (benchmark) => {
        try {
          const statsResponse = await fetch(`./results/${llm_name}/${benchmark}/statistics_${benchmark}_instruct_${strategy}.json`);
          const statsResult = await statsResponse.json();
          metrics.forEach(metric => {
            row[`${benchmark}_${metric}`] = statsResult[metric];
          });

          // Update bug count for each benchmark
          if (!newBugCounts[benchmark]) {
            newBugCounts[benchmark] = statsResult.num_bugs_with_prompt;
            totalBugs += statsResult.num_bugs_with_prompt;
          }

          const costResponse = await fetch(`./results/${llm_name}/${benchmark}/costs_${benchmark}_instruct_${strategy}.json`);
          const costResult = await costResponse.json();
          row[`${benchmark}_cost`] = costResult.total_cost || null;

          // Load release date
          const releaseDateResponse = await fetch(`./results/release_dates.json`);
          const releaseDateData = await releaseDateResponse.json();
          row['release_date'] = releaseDateData[llm_name];
        } catch (error) {
          console.error(`Failed to load data for ${llm_name} - ${benchmark}:`, error);
          allBenchmarksComplete = false;
        }
      }));

      // Only compute total cost if all benchmarks are complete and there's no total.json
      if (allBenchmarksComplete && row.hasTotalData) {
        row.total_cost = benchmarks.reduce((sum, benchmark) => sum + (row[`${benchmark}_cost`] || 0), 0);
      }

      return row;
    }));

    setData(results);
    setBugCounts({ ...newBugCounts, total: totalBugs });
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getBestScores = (data) => {
    const bestScores = {};
    const metrics = ['exact_match@1', 'ast_match@1', 'plausible@1'];
    const benchmarks = ['defects4j', 'gitbugjava', 'total'];

    benchmarks.forEach(benchmark => {
      metrics.forEach(metric => {
        const key = `${benchmark}_${metric}`;
        bestScores[key] = Math.max(...data.map(row => row[key] || 0));
      });
    });

    return bestScores;
  };

  const formatPercentage = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return (value * 100).toFixed(1).replace('.', ',') + '%';
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const sortNumeric = (rowA, rowB, columnId) => {
    const a = rowA.values[columnId];
    const b = rowB.values[columnId];
    
    const aValue = a === 'N/A' || a === undefined ? 0 : a;
    const bValue = b === 'N/A' || b === undefined ? 0 : b;
    
    return aValue - bValue;
  };

//  const parseDateString = (dateString) => {
//    if (!dateString) return new Date(0); // Return earliest possible date if undefined
//    const [year, month, day] = dateString.split('-');
//    return new Date(parseInt(year), parseInt(month)-1, parseInt(day));
//  };

  const columns = React.useMemo(() => {
    const bestScores = getBestScores(data);

    const createColumn = (header, accessor, format = formatPercentage) => ({
      Header: header,
      accessor: accessor,
      Cell: ({ value }) => (
        <div className="cell-content">
          <span className={value === bestScores[accessor] ? 'bold' : ''}>
            {format(value)}
          </span>
        </div>
      ),
      sortType: sortNumeric,
      disableSortBy: false,
      // Removed fixed widths for flexibility
    });

    // Updated createCostColumn to remove bold styling
    const createCostColumn = (header, accessor) => ({
      Header: header,
      accessor: accessor,
      Cell: ({ value }) => (
        <div className="cell-content">
          <span>
            {formatCurrency(value)}
          </span>
        </div>
      ),
      sortType: sortNumeric,
      disableSortBy: false,
    });

    const baseColumns = [
      {
        Header: 'Organization',
        accessor: 'provider',
        Cell: ({ value }) => (
          <div className="provider-cell">
            <ReactCountryFlag countryCode={llmCountryMap[value] || 'UN'} svg className="country-flag" />
            <span className="provider-name">{value}</span>
          </div>
        ),
        disableSortBy: false
      },
      {
        Header: 'Model',
        accessor: 'name',
        Cell: ({ row }) => (
          <div className="model-name-cell">
            <div className="model-name-content">
              {row.original.name}
              {!row.original.hasTotalData && <sup>*</sup>}
            </div>
          </div>
        ),
        disableSortBy: false,
      },
      // {
      //   Header: 'Release Date',
      //   accessor: 'release_date',
      //   Cell: ({ value }) => (
      //     <div className="release-date-cell">
      //       <div className="release-date-content">
      //         {value}
      //       </div>
      //     </div>
      //   ),
      //   sortType: (rowA, rowB, columnId) => {
      //     const dateA = parseDateString(rowA.values[columnId]);
      //     const dateB = parseDateString(rowB.values[columnId]);
      //     return dateA.getTime() - dateB.getTime();
      //   },
      //   disableSortBy: false,
      // },
      {
        Header: `Total (${bugCounts.total || 0} bugs)`,
        columns: [
          createColumn('Plausible @1', 'total_plausible@1'),
          createColumn('AST Match @1', 'total_ast_match@1'),
          createCostColumn('Cost', 'total_cost'), // Cost column without bold
        ],
      }
    ];

    const extraColumns = [
      {
        Header: `Defects4J v2 (${bugCounts.defects4j || 0} bugs)`,
        columns: [
          createColumn('Plausible @1', 'defects4j_plausible@1'),
          createColumn('AST Match @1', 'defects4j_ast_match@1'),
          createCostColumn('Cost', 'defects4j_cost'), // Cost column without bold
        ],
      },
      {
        Header: `GitBug-Java (${bugCounts.gitbugjava || 0} bugs)`,
        columns: [
          createColumn('Plausible @1', 'gitbugjava_plausible@1'),
          createColumn('AST Match @1', 'gitbugjava_ast_match@1'),
          createCostColumn('Cost', 'gitbugjava_cost'), // Cost column without bol
        ],
      }
    ];

    return showExtraColumns ? [...baseColumns, ...extraColumns] : baseColumns;
  }, [data, bugCounts, showExtraColumns]);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { 
      columns, 
      data,
      initialState: {
        sortBy: [
          { id: 'total_plausible@1', desc: true }
        ]
      },
      disableSortRemove: true,
      disableMultiSort: true
    },
    useSortBy
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-table-wrapper">
        <div className={`leaderboard-table-container ${showExtraColumns ? 'expanded' : ''}`}>
          <table {...getTableProps()} className="leaderboard-table">
            <thead>
              {headerGroups.map((headerGroup, i) => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map(column => (
                    <th
                      {...column.getHeaderProps(column.getSortByToggleProps())}
                      className={`table-header ${column.canSort ? 'sortable' : ''} ${i === 0 ? 'top-header' : 'sub-header'}`}
                    >
                      <div className="header-content">
                        <span className="header-text">{column.render('Header')}</span>
                        {column.canSort && i !== 0 && (
                          <span className="sort-indicator">
                            {column.isSorted
                              ? column.isSortedDesc
                                ? <FaSortDown />
                                : <FaSortUp />
                              : <FaSort />}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()}>
              {rows.map(row => {
                prepareRow(row);
                return (
                  <tr {...row.getRowProps()}>
                    {row.cells.map(cell => (
                      <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div 
          className="toggle-bar" 
          onClick={() => setShowExtraColumns(!showExtraColumns)}
        >
          <span className="toggle-text">
            {showExtraColumns ? 'Collapse' : 'See more details...'}
          </span>
        </div>
      </div>
      
      <div className="methodology-info">
        <ul>
          <li>All bugs included in RepairBench are single-function bugs, meaning that the reference patch changes only one function</li>
          <li>The prompt is zero-shot, and includes 1) the buggy function, 2) the failing test cases, and 3) the test errors</li>
          <li>AST Match means that the generated patch has the same AST as the reference patch</li>
          <li>Plausible means that the generated patch passes all the tests in the test suite</li>
          <li>pass@1 values are estimated from 10 non-deterministic generations with temperature of 1.0</li>
          <li>Costs are calculated according to the pricing model of the model's organization. If the model is open-weights and not hosted by the model's organization, the pricing is calculated according to the provider chosen by the authors.</li>
          <li>Leaderboard is sorted, by default, by the total plausible@1 metric</li>
          <li>* Only partial results available right now due to cost reasons.</li>
          <li>We publish the <a href="https://github.com/ASSERT-KTH/elle-elle-aime" target="_blank" rel="noopener noreferrer">code</a> and <a href="https://github.com/ASSERT-KTH/repairbench" target="_blank" rel="noopener noreferrer">data</a> to enable reproducibility.</li>
          <li>For more details, please refer to the <a href="https://arxiv.org/pdf/2409.18952" target="_blank" rel="noopener noreferrer">technical report on arXiv</a>.</li>
          <li>We thank the following companies for providing API credits to run RepairBench on their models: <a href="https://mistral.ai/" target="_blank" rel="noopener noreferrer">Mistral</a>.</li>
        </ul>
      </div>

      <div className="footnote">
        
      </div>

      {<CitationBox />}
      <Footer />
    </div>
  );
};

export default LeaderboardTable;
