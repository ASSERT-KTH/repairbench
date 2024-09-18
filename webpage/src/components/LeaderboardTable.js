// src/components/LeaderboardTable.js
import React, { useState, useEffect } from 'react';
import { useTable, useSortBy } from 'react-table';
import ReactCountryFlag from "react-country-flag";
import CitationBox from './CitationBox'; // Import the new component
import Footer from './Footer'; // Import the Footer component
import './LeaderboardTable.css'; // Add some basic CSS styling
import { modelList, llmCountryMap } from './modelConfig';

const LeaderboardTable = () => {
  const [data, setData] = useState([]);

  // Function to load data from JSON files
  const loadData = async () => {
    const benchmarks = ['defects4j', 'gitbugjava'];
    const metrics = ['exact_match@1', 'ast_match@1', 'plausible@1'];

    let results = [];
    for (const [llm_name, strategy, provider] of modelList) {
      const row = { name: llm_name, provider: provider, total_cost: 0 };

      // Load total.json
      try {
        const total_response = await fetch(`./results/${llm_name}/total.json`);
        const total_result = await total_response.json();
        row['total_ast_match@1'] = total_result['ast_match@1'];
        row['total_plausible@1'] = total_result['plausible@1'];
      } catch (error) {
        console.error(`Failed to load total.json for ${llm_name}:`, error);
      }

      for (const benchmark of benchmarks) {
        try {
          const stats_response = await fetch(`./results/${llm_name}/${benchmark}/statistics_${benchmark}_instruct_${strategy}.json`);
          const stats_result = await stats_response.json();
          metrics.forEach(metric => {
            row[`${benchmark}_${metric}`] = stats_result[metric];
          });
          // Add the total_cost from each benchmark
          const cost_response = await fetch(`./results/${llm_name}/${benchmark}/costs_${benchmark}_instruct_${strategy}.json`);
          const cost_result = await cost_response.json();
          row.total_cost += cost_result.total_cost || 0;
        } catch (error) {
          console.error(`Failed to load data for ${llm_name} - ${benchmark}:`, error);
        }
      }
      results.push(row);
    }
    setData(results);
  };

  // Function to find the best score for each metric
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

  // Helper function to format number as percentage
  const formatPercentage = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return (value * 100).toFixed(1).replace('.', ',') + '%';
  };

  // Helper function to format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Define columns for the table
  const columns = React.useMemo(
    () => {
      const bestScores = getBestScores(data);

      const createColumn = (header, accessor, format = formatPercentage) => ({
        Header: () => (
          <div className="column-header">
            <span>{header}</span>
          </div>
        ),
        accessor: accessor,
        Cell: ({ value }) => (
          <div className="cell-content">
            <span className={value === bestScores[accessor] ? 'bold' : ''}>
              {format(value)}
            </span>
          </div>
        )
      });

      return [
        {
          Header: 'Organization',
          accessor: 'provider',
          Cell: ({ value }) => (
            <div className="provider-cell">
              <ReactCountryFlag
                countryCode={llmCountryMap[value] || 'UN'}
                svg
                className="country-flag"
              />
              <span className="provider-name">{value}</span>
            </div>
          )
        },
        {
          Header: 'Model',
          accessor: 'name',
          Cell: ({ value }) => (
            <div className="model-name-cell">
              <div className="model-name-content">{value}</div>
            </div>
          )
        },
        {
          Header: 'Defects4J',
          columns: [
            createColumn('AST Match @1', 'defects4j_ast_match@1'),
            createColumn('Plausible @1', 'defects4j_plausible@1'),
          ],
        },
        {
          Header: 'GitBug-Java',
          columns: [
            createColumn('AST Match @1', 'gitbugjava_ast_match@1'),
            createColumn('Plausible @1', 'gitbugjava_plausible@1'),
          ],
        },
        {
          Header: 'Total',
          columns: [
            createColumn('AST Match @1', 'total_ast_match@1'),
            createColumn('Plausible @1', 'total_plausible@1'),
            createColumn('Cost', 'total_cost', formatCurrency),
          ],
        }
      ];
    },
    [data]
  );

  // Create the table instance
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { 
      columns, 
      data,
      initialState: {
        sortBy: [
          { id: 'total_plausible@1', desc: true },
        ]
      }
    },
    useSortBy
  );

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-table-container">
        <table {...getTableProps()} className="leaderboard-table">
          <thead>
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <th {...column.getHeaderProps(column.getSortByToggleProps())} className="table-header">
                    {column.render('Header')}
                    {column.isSorted && (
                      <span className="sort-indicator">
                        {column.isSortedDesc ? ' 🔽' : ' 🔼'}
                      </span>
                    )}
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
      <CitationBox /> {/* Add the CitationBox component here */}
      <Footer /> {/* Add the Footer component here */}
    </div>
  );
};

export default LeaderboardTable;
