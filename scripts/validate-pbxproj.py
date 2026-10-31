#!/usr/bin/env python3
"""Validate project.pbxproj: balanced braces/strings and every referenced
24-hex UUID is defined. Also generate the tvOS app icons."""
import re, sys

path = '/home/z/my-project/apple-tv/ShiaAzanTV.xcodeproj/project.pbxproj'
src = open(path).read()

# strip comments
no_comments = re.sub(r'/\*.*?\*/', '', src, flags=re.S)

# brace balance
depth, min_depth = 0, 0
for ch in no_comments:
    if ch == '{':
        depth += 1
    elif ch == '}':
        depth -= 1
        min_depth = min(min_depth, depth)
print('brace balance:', depth, '(0 = balanced), min depth:', min_depth)
assert depth == 0 and min_depth >= 0, 'UNBALANCED BRACES'

# string balance (rough): count unescaped quotes per line must be even
bad_lines = [i + 1 for i, line in enumerate(no_comments.splitlines())
             if line.count('"') % 2 != 0]
print('odd-quote lines:', bad_lines or 'none')
assert not bad_lines

# UUID integrity: IDs defined as keys = left side of "ID /* x */ = {"
defined = set(re.findall(r'^\s*([0-9A-F]{24})\s*/\*', src, flags=re.M))
# referenced IDs: fileRef = ID, A100... in children lists, buildConfigurationList etc.
referenced = set(re.findall(r'(?:fileRef|productReference|mainGroup|productRefGroup|rootObject)\s*=\s*([0-9A-F]{24})', src))
referenced |= set(re.findall(r'children\s*=\s*\(([^)]*)\)', src, flags=re.S) and
                  re.findall(r'([0-9A-F]{24})\s*/\*', ' '.join(re.findall(r'children\s*=\s*\(([^)]*)\)', src, flags=re.S))))
referenced |= set(re.findall(r'buildConfigurations\s*=\s*\(([^)]*)\)', src, flags=re.S) and
                  re.findall(r'([0-9A-F]{24})\s*/\*', ' '.join(re.findall(r'buildConfigurations\s*=\s*\(([^)]*)\)', src, flags=re.S))))
referenced |= set(re.findall(r'targets\s*=\s*\(([^)]*)\)', src, flags=re.S) and
                  re.findall(r'([0-9A-F]{24})\s*/\*', ' '.join(re.findall(r'targets\s*=\s*\(([^)]*)\)', src, flags=re.S))))
referenced |= set(re.findall(r'buildPhases\s*=\s*\(([^)]*)\)', src, flags=re.S) and
                  re.findall(r'([0-9A-F]{24})\s*/\*', ' '.join(re.findall(r'buildPhases\s*=\s*\(([^)]*)\)', src, flags=re.S))))
print(f'defined UUIDs: {len(defined)}, referenced: {len(referenced)}')
missing = referenced - defined
print('missing definitions:', missing or 'none')
assert not missing, f'MISSING: {missing}'
print('pbxproj structure OK')
