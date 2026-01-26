#!/usr/bin/env python3
"""Configure Ghost to use the optimized-local storage adapter."""

import json
import sys

def configure_storage(config_file, storage_path):
    with open(config_file, 'r') as f:
        config = json.load(f)

    config['storage'] = {
        'active': 'optimized-local',
        'optimized-local': {
            'storagePath': storage_path,
            'sizes': [600, 1000, 1600, 2000],
            'quality': 82,
            'keepOriginal': True
        }
    }

    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)

    print('Storage adapter configured successfully')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(f'Usage: {sys.argv[0]} <config_file> <storage_path>')
        sys.exit(1)
    configure_storage(sys.argv[1], sys.argv[2])
