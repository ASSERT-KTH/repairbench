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

  const loadData = async () => {
    const benchmarks = ['defects4j', 'gitbugjava'];
    const metrics = ['exact_match@1', 'ast_match@1', 'plausible@1'];
    let newBugCounts = {};
    let totalBugs = 0;

    const results = await Promise.all(modelList.map(async ([llm_name, strategy, provider]) => {
      const row = { name: llm_name, provider, total_cost: 0 };

      try {
        const totalResponse = await fetch(`./results/${llm_name}/total.json`);
        const totalResult = await totalResponse.json();
        row['total_ast_match@1'] = totalResult['ast_match@1'];
        row['total_plausible@1'] = totalResult['plausible@1'];
      } catch (error) {
        console.error(`Failed to load total.json for ${llm_name}:`, error);
      }

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
          row.total_cost += costResult.total_cost || 0;
        } catch (error) {
          console.error(`Failed to load data for ${llm_name} - ${benchmark}:`, error);
        }
      }));

      return row;
    }));

    setData(results);
    setBugCounts({ ...newBugCounts, total: totalBugs });
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
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

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
      sortType: 'basic',
      disableSortBy: false
    });

    return [
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
        Cell: ({ value }) => (
          <div className="model-name-cell">
            <div className="model-name-content">{value}</div>
          </div>
        ),
        disableSortBy: false
      },
      {
        Header: `Defects4J (${bugCounts.defects4j || 0} bugs)`,
        columns: [
          createColumn('AST Match @1', 'defects4j_ast_match@1'),
          createColumn('Plausible @1', 'defects4j_plausible@1'),
        ],
      },
      {
        Header: `GitBug-Java (${bugCounts.gitbugjava || 0} bugs)`,
        columns: [
          createColumn('AST Match @1', 'gitbugjava_ast_match@1'),
          createColumn('Plausible @1', 'gitbugjava_plausible@1'),
        ],
      },
      {
        Header: `Total (${bugCounts.total || 0} bugs)`,
        columns: [
          createColumn('AST Match @1', 'total_ast_match@1'),
          createColumn('Plausible @1', 'total_plausible@1'),
          createColumn('Cost', 'total_cost', formatCurrency),
        ],
      }
    ];
  }, [data, bugCounts]);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { 
      columns, 
      data,
      initialState: {
        sortBy: [{ id: 'total_plausible@1', desc: true }]
      }
    },
    useSortBy
  );

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-table-container">
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
      {/* <CitationBox /> */}
      <Footer />
    </div>
  );
};

export default LeaderboardTable;
