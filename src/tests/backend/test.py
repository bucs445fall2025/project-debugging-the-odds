# backend/test.py
from dataclasses import dataclass
import requests
from typing import Any, Optional
from urllib.parse import urljoin
from colorama import Fore, Style, init
from backend import Test
from random import choice,choices, randint
import string
import shutil

width = shutil.get_terminal_size().columns
init( autoreset = True )

def random_email():
    domain_list = ["gmail.com", "yahoo.com", "outlook.com", "example.com"]
    name = ''.join(choices(string.ascii_lowercase + string.digits, k=randint(6, 12)))
    domain = choice(domain_list)
    return f"{name}@{domain}"

def run_backend_tests():
    print( f'\n\n{Fore.YELLOW}[Backend] {Fore.CYAN}Testing Users{Fore.RESET}' )

    print( '-' * width )

    first_email = random_email()
    result = Test( 'sign-up', 'POST', 'authentication/sign/up', 200, {
        'Email': first_email,
        'Password': 'plsnohack'
    } )

    # duplicate
    result = Test( 'duplicate sign-up', 'POST', 'authentication/sign/up', 400, {
        'Email': first_email,
        'Password': 'plsnohack'
    } )

    second_email = random_email()
    result = Test( 'duplicate sign-up', 'POST', 'authentication/sign/up', 200, {
        'Email': second_email,
        'Password': 'plsnohack'
    })
    # get users

    result = Test( 'get user by email', 'GET', f'get/user/by/email/{ first_email }', 200 )
    first_user = result.get_result()['data']

    result = Test( 'get user by id', 'GET', f'get/user/by/id/{ first_user["id"] }', 200 )

    result = Test( 'get seond user by email', 'GET', f'get/user/by/email/{ second_email }', 200 )
    second_user = result.get_result()['data']

    result = Test( 'get nonexistent user', 'GET', f'get/user/by/email/lllll@l.com', 404 )

    result = Test( "dump-users", "GET", "debug/dump/users", 200 )


    result = Test( 'sign-in', 'post', 'authentication/sign/in', 200, {
        'email': first_email,
        'password': 'plsnohack'
    })


    print( f'\n\n{Fore.YELLOW}[Backend] {Fore.CYAN}Testing Items{Fore.RESET}' )

    print( '-' * width )


    result = Test( "create-item", "POST", "create/item", 200, {
            "OwnerID": first_user['id'],
            "Name": "Cow",
            "Category": 8,
            "Description": "Another fat piece of meat 🥩🤤"
    } )



    result = Test( "create second item", "POST", "create/item", 200, {
            "OwnerID": second_user['id'],
            "Name": "sheep",
            "Category": 8,
            "Description": "worthless"
    } )

    result = Test( 'get items by owner', 'get', f'get/items/by/owner/{ first_user["id"] }', 200 )
    first_items = result.get_result()['data']
    result = Test( 'get items by second owner', 'get', f'get/items/by/owner/{ second_user["id"] }', 200 )
    second_items = result.get_result()['data']


    result = Test( 'get item by id', 'get', f'get/item/by/id/{ first_items[0]["id"] }', 200 )

    result = Test( 'update item by id', 'patch', f'update/item', 200, {
        "id": second_items[0]['id'],
        "Name": "sheeper",
        "Category": 3,
        "Description": "mutton maniac"
    } )

    print( f'\n\n{Fore.YELLOW}[Backend] {Fore.CYAN}Testing Trading{Fore.RESET}' )

    print( '-' * width )

    result = Test( 'create valid trade', 'post', 'create/trade', 200, {
        "initiator": first_user['id'],
        "receiver": second_user['id'],
        "OfferingItems": [ first_items[0]['id'] ],
        "SeekingItems": [second_items[0]['id']]
    })
    
    result = Test( 'error trading with your own items', 'post', 'create/trade', 400, {
        "initiator": first_user['id'],
        "receiver": second_user['id'],
        "OfferingItems": [ first_items[0]['id'] ],
        "SeekingItems": [ first_items[0]['id']]

    })


if __name__ == "__main__":
    run_backend_tests()

