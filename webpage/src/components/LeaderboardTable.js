import React, { useState } from 'react';
import { useTable, useSortBy } from 'react-table';
import ReactCountryFlag from "react-country-flag";
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import CitationBox from './CitationBox';
import Footer from './Footer';
import { llmCountryMap } from './modelConfig';
import staticData from '../data/leaderboard-data.json';
import './LeaderboardTable.css';

const LeaderboardTable = () => {
  const [showExtraColumns, setShowExtraColumns] = useState(false);
  
  // Use static data instead of fetching
  const data = staticData.results;
  const bugCounts = staticData.bugCounts;

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

  const formatNumber = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return (value / 1_000_000).toFixed(1) + 'M';
  };

  const formatTokens = (input, output) => {
    if (input === undefined || input === null || output === undefined || output === null) return 'N/A';
    return `${formatNumber(input)} + ${formatNumber(output)}`;
  };

  const sortNumeric = (rowA, rowB, columnId) => {
    const a = rowA.values[columnId];
    const b = rowB.values[columnId];
    
    const aValue = a === 'N/A' || a === undefined ? 0 : a;
    const bValue = b === 'N/A' || b === undefined ? 0 : b;
    
    return aValue - bValue;
  };

  const sortTokenColumn = (rowA, rowB, columnId) => {
    const a = rowA.values[columnId];
    const b = rowB.values[columnId];

    if (a === 'N/A' || b === 'N/A') return a === 'N/A' ? 1 : -1;

    const [aInput, aOutput] = a.split(' + ').map(val => parseFloat(val.replace('M', '')));
    const [bInput, bOutput] = b.split(' + ').map(val => parseFloat(val.replace('M', '')));

    const aValue = aInput + aOutput;
    const bValue = bInput + bOutput;

    return aValue - bValue;
  };

  const parseDateString = (dateString) => {
    if (!dateString) return new Date(0); // Return earliest possible date if undefined
    const [year, month, day] = dateString.split('-');
    return new Date(parseInt(year), parseInt(month)-1, parseInt(day));
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

    const createTokenColumn = (header, inputAccessor, outputAccessor, id) => ({
      Header: header,
      accessor: row => {
        const inputTokens = row[inputAccessor];
        const outputTokens = row[outputAccessor];
        if (inputTokens === undefined || inputTokens === null || outputTokens === undefined || outputTokens === null || inputTokens === 'N/A' || outputTokens === 'N/A') {
          return 'N/A';
        }
        return formatTokens(inputTokens, outputTokens);
      },
      id: id,
      Cell: ({ value }) => (
        <div className="cell-content">
          <span>
            {value}
          </span>
        </div>
      ),
      sortType: sortTokenColumn,
      disableSortBy: false,
    });

    const baseColumns = [
      {
        Header: 'Organization',
        accessor: 'provider',
        Cell: ({ value }) => (
          <div className="provider-cell">
            <ReactCountryFlag countryCode={llmCountryMap[value] || 'XX'} svg className="country-flag" />
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
      {
        Header: 'Release Date',
        accessor: 'release_date',
        Cell: ({ value }) => (
          <div className="release-date-cell">
            <div className="release-date-content">
              {value}
            </div>
          </div>
        ),
        sortType: (rowA, rowB, columnId) => {
          const dateA = parseDateString(rowA.values[columnId]);
          const dateB = parseDateString(rowB.values[columnId]);
          return dateA.getTime() - dateB.getTime();
        },
        disableSortBy: false,
      }
    ];

    const detailColumns = [
      {
        Header: `Defects4J v2 (${bugCounts.defects4j || 0} bugs)`,
        columns: [
          createColumn('Plausible @1', 'defects4j_plausible@1'),
          createColumn('AST Match @1', 'defects4j_ast_match@1'),
          createCostColumn('Cost', 'defects4j_cost'),
          createTokenColumn('Tokens', 'defects4j_prompt_tokens', 'defects4j_completion_tokens', 'defects4j_tokens'),
        ],
      },
      {
        Header: `GitBug-Java (${bugCounts.gitbugjava || 0} bugs)`,
        columns: [
          createColumn('Plausible @1', 'gitbugjava_plausible@1'),
          createColumn('AST Match @1', 'gitbugjava_ast_match@1'),
          createCostColumn('Cost', 'gitbugjava_cost'),
          createTokenColumn('Tokens', 'gitbugjava_prompt_tokens', 'gitbugjava_completion_tokens', 'gitbugjava_tokens'),
        ],
      }
    ];

    const totalColumns = [{
      Header: `Total (${bugCounts.total || 0} bugs)`,
      columns: [
        createColumn('Plausible @1', 'total_plausible@1'),
        createColumn('AST Match @1', 'total_ast_match@1'),
        createCostColumn('Cost', 'total_cost'),
        ...(showExtraColumns ? [
          createTokenColumn('Tokens', 'total_prompt_tokens', 'total_completion_tokens', 'total_tokens')
        ] : []),
      ],
    }];

    return [...baseColumns, ...(showExtraColumns ? detailColumns : []), ...totalColumns];
  }, [showExtraColumns]); // Remove data and bugCounts from dependencies since they're now static

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow
  } = useTable(
    {
      columns,
      data,
      initialState: { sortBy: [{ id: 'total_plausible@1', desc: true }] }
    },
    useSortBy
  );

  const handleToggleTouch = (e) => {
    e.preventDefault();
    setShowExtraColumns(!showExtraColumns);
  };

  return (
    <div className="leaderboard-container">
      <div className="retired-message" role="note">
        This leaderboard is now retired. Last update was on June 11th 2025.
      </div>
      <div className="leaderboard-table-wrapper">
        <div className={`leaderboard-table-container ${showExtraColumns ? 'expanded' : ''}`}>
          <table {...getTableProps()} className="leaderboard-table" role="table">
            <thead>
              {headerGroups.map((headerGroup, i) => (
                <tr {...headerGroup.getHeaderGroupProps()} role="row">
                  {headerGroup.headers.map(column => (
                    <th
                      {...column.getHeaderProps(column.getSortByToggleProps())}
                      className={`table-header ${column.canSort ? 'sortable' : ''} ${i === 0 ? 'top-header' : 'sub-header'}`}
                      role="columnheader"
                      aria-sort={column.isSorted ? (column.isSortedDesc ? 'descending' : 'ascending') : 'none'}
                    >
                      <div className="header-content">
                        <span className="header-text">{column.render('Header')}</span>
                        {column.canSort && i !== 0 && (
                          <span className="sort-indicator" aria-hidden="true">
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
            <tbody {...getTableBodyProps()} role="rowgroup">
              {rows.map(row => {
                prepareRow(row);
                return (
                  <tr {...row.getRowProps()} role="row">
                    {row.cells.map(cell => (
                      <td {...cell.getCellProps()} role="cell">{cell.render('Cell')}</td>
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
          onTouchStart={handleToggleTouch}
          role="button"
          tabIndex={0}
          aria-label={showExtraColumns ? "Hide detailed results" : "Show detailed results"}
        >
          <span className="toggle-text">
            {showExtraColumns ? 'Collapse' : 'See more details...'}
          </span>
        </div>
      </div>
      
      <div className="methodology-info" role="complementary">
        <ul>
          <li>All bugs included in RepairBench are single-function bugs, meaning that the reference patch changes only one function</li>
          <li>The prompt is zero-shot, and includes 1) the buggy function, 2) the failing test cases, and 3) the test errors</li>
          <li>AST Match means that the generated patch has the same AST as the reference patch</li>
          <li>Plausible means that the generated patch passes all the tests in the test suite</li>
          <li>pass@1 values are estimated from 10 non-deterministic generations with temperature of 1.0</li>
          <li>Costs are calculated according to the pricing model of the model's organization. If the model is open-weights and not hosted by the model's organization, the pricing is calculated according to the provider chosen by the authors.</li>
          <li>The token count is according to the tokenizer of each model. Some providers allow generating answers in batch. For those, the input tokens are only counted once instead of 10 times.</li>
          <li>Leaderboard is sorted, by default, by the total plausible@1 metric</li>
          <li>* Only partial results available right now due to cost reasons.</li>
          <li>We publish the <a href="https://github.com/ASSERT-KTH/elle-elle-aime" target="_blank" rel="noopener noreferrer">code</a> and <a href="https://github.com/ASSERT-KTH/repairbench" target="_blank" rel="noopener noreferrer">data</a> to enable reproducibility.</li>
          <li>For more details, please refer to the <a href="https://arxiv.org/pdf/2409.18952" target="_blank" rel="noopener noreferrer">technical report on arXiv</a>.</li>
          <li>We thank the following companies for providing API credits to run RepairBench on their models: {' '}
            <a href="https://google.com/" target="_blank" rel="noopener noreferrer">Google</a>, {' '}
            <a href="https://mistral.ai/" target="_blank" rel="noopener noreferrer">Mistral</a>, {' '}
            <a href="https://openai.com/" target="_blank" rel="noopener noreferrer">OpenAI</a>.
            </li>
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
