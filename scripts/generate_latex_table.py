import json
import os
from collections import defaultdict
from datetime import datetime

# Mapping of providers to their respective country codes
llm_country_map = {
    'Google': 'US',
    'OpenAI': 'US',
    'Meta': 'US',
    'DeepSeek': 'CN',
    'Mistral': 'EU',
    'Alibaba Cloud': 'CN',
    'Anthropic': 'US',
}

def load_data(results_dir):
    data = []
    model_list = [
        ('gemini-1.5-pro-001', "google", "Google"),
        ('gpt-4o-2024-08-06', "openai-chatcompletion", "OpenAI"),
        ('o1-preview-2024-09-12', "openai-chatcompletion", "OpenAI"),
        ('llama-3.1-405b-instruct', 'openrouter', 'Meta'),
        ('deepseek-v2.5', 'openrouter', 'DeepSeek'),
        ('mistral-large-2407', 'openrouter', 'Mistral'),
        ('qwen-2.5-72b-instruct', 'openrouter', 'Alibaba Cloud'),
        ('claude-3-5-sonnet-20240620', 'anthropic', 'Anthropic'),
    ]
    benchmarks = ['defects4j', 'gitbugjava']
    metrics = ['ast_match@1', 'plausible@1']

    for llm_name, strategy, provider in model_list:
        row = {'name': llm_name, 'provider': provider, 'total_cost': 0}

        try:
            with open(f"{results_dir}/{llm_name}/total.json") as f:
                total_result = json.load(f)
                row['total_ast_match@1'] = total_result.get('ast_match@1', None)
                row['total_plausible@1'] = total_result.get('plausible@1', None)
                row['total_cost'] = total_result.get('cost', 0)
        except FileNotFoundError:
            print(f"Warning: total.json not found for {llm_name}")
            row['total_ast_match@1'] = None
            row['total_plausible@1'] = None

        for benchmark in benchmarks:
            try:
                with open(f"{results_dir}/{llm_name}/{benchmark}/statistics_{benchmark}_instruct_{strategy}.json") as f:
                    stats_result = json.load(f)
                    for metric in metrics:
                        row[f"{benchmark}_{metric}"] = stats_result.get(metric, None)

                with open(f"{results_dir}/{llm_name}/{benchmark}/costs_{benchmark}_instruct_{strategy}.json") as f:
                    cost_result = json.load(f)
                    row[f"{benchmark}_cost"] = cost_result.get('total_cost', 0)
                    row['total_cost'] += cost_result.get('total_cost', 0)
            except FileNotFoundError:
                print(f"Warning: Data not found for {llm_name} - {benchmark}")
                for metric in metrics:
                    row[f"{benchmark}_{metric}"] = None
                row[f"{benchmark}_cost"] = None

        data.append(row)

    return data

def find_best_scores(data):
    best_scores = defaultdict(lambda: -float('inf'))
    for row in data:
        for key, value in row.items():
            if key.endswith('ast_match@1') or key.endswith('plausible@1'):
                if value is not None and value > best_scores[key]:
                    best_scores[key] = value
    return best_scores

def generate_latex_table(data):
    best_scores = find_best_scores(data)
    
    latex = "\\begin{table}[ht]\n"
    latex += "\\centering\n"
    latex += "\\makebox[\\textwidth][c]{%\n"
    latex += "\\resizebox{1.25\\textwidth}{!}{\n"
    latex += "\\large\n"
    latex += "\\begin{tabular}{@{}ll "

    # Modify each S column to include detect-weight=true
    s_columns = [
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=4.2, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=4.2, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=4.2, detect-weight=true]"
    ]
    latex += ' '.join(s_columns) + "@{}}\n"
    
    latex += "\\toprule\n"
    latex += "\\multirow{2}{*}{\\textbf{Organization}} & \\multirow{2}{*}{\\textbf{Model}} & \\multicolumn{3}{c}{Defects4J v2 (484 bugs)} & \\multicolumn{3}{c}{GitBug-Java (90 bugs)} & \\multicolumn{3}{c}{\\textbf{Total (574 bugs)}} \\\\\n"
    latex += "\\cmidrule(lr){3-5} \\cmidrule(lr){6-8} \\cmidrule(l){9-11}\n"
    latex += " & & {AST Match@1} & {Plausible@1} & {Cost (\\$)} & {AST Match@1} & {Plausible@1} & {Cost (\\$)} & {\\textbf{AST Match@1}} & {\\textbf{Plausible@1}\\textsuperscript{1}} & {\\textbf{Cost (\\$)}} \\\\\n"
    latex += "\\midrule\n"

    partial_footnote_needed = False  # Flag to check if footnote is required

    for row in sorted(data, key=lambda x: x['total_plausible@1'] if x['total_plausible@1'] is not None else -1, reverse=True):
        has_incomplete_results = any(row[f"{benchmark}_{metric}"] is None 
                                     for benchmark in ['defects4j', 'gitbugjava'] 
                                     for metric in ['ast_match@1', 'plausible@1'])
        
        if has_incomplete_results:
            suffix = "\\textsuperscript{2}"
            partial_footnote_needed = True  # Set flag to add footnote later
        else:
            suffix = ""

        # Get the model name
        model_name = row['name']
        
        # Get the country code for the provider
        country_code = llm_country_map.get(row['provider'], 'UN')  # 'UN' for unknown
        
        # Insert the flag using the flag-icon package
        provider_with_flag = f"\\worldflag[width=0.3cm]{{{country_code}}} {row['provider']}"
        
        # Start building the LaTeX row with suffix appended
        latex += f"{provider_with_flag}{suffix} & {model_name}{suffix} & "
        
        for benchmark in ['defects4j', 'gitbugjava', 'total']:
            for metric in ['ast_match@1', 'plausible@1']:
                key = f"{benchmark}_{metric}"
                value = row[key]
                if value is not None:
                    if value == best_scores[key]:
                        cell = f"\\B {value*100:.1f}\\%{suffix if benchmark == 'total' else ''}"
                    else:
                        cell = f"{value*100:.1f}\\%{suffix if benchmark == 'total' else ''}"
                else:
                    cell = f"\\multicolumn{{1}}{{c}}{{---}}{suffix if benchmark == 'total' else ''}"
                latex += f"{cell} & "
            
            cost = row[f'{benchmark}_cost']
            if cost is not None:
                cell = f"\\${cost:.2f}{suffix if benchmark == 'total' else ''}"
            else:
                cell = f"\\multicolumn{{1}}{{c}}{{---}}{suffix if benchmark == 'total' else ''}"
            
            latex += f"{cell} & "

        latex = latex.rstrip('& ') + '\\\\\n'

    latex += "\\bottomrule\n"
    # Add the footnote once after all rows
    latex += "\\addlinespace\n"
    latex += f"\\multicolumn{{11}}{{l}}{{\\textsuperscript{{1}}Models are sorted by the total Plausible@1 score.}} \\\\\n"
    if partial_footnote_needed:
        latex += f"\\multicolumn{{11}}{{l}}{{\\textsuperscript{{2}}Only partial results available right now due to cost reasons.}} \\\\\n"
    latex += "\\addlinespace\n"
    latex += "\\end{tabular}\n"
    latex += "}\n"
    latex += "}\n"
    latex += "\\caption{Leaderboard of Frontier Models for Program Repair as of " + datetime.now().strftime("%B %d, %Y") + "}\n"
    latex += "\\label{tab:leaderboard}\n"
    latex += "\\end{table}\n"

    return latex

def main():
    results_dir = os.path.join(os.path.dirname(__file__), '..', 'results')
    data = load_data(results_dir)
    latex_table = generate_latex_table(data)

    print(latex_table)
    

if __name__ == "__main__":
    main()
