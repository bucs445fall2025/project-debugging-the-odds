from dataclasses import dataclass
import requests
from typing import Any, Optional
from urllib.parse import urljoin
from colorama import Fore, Style, init

init(autoreset=True)

BASE_URL = "http://localhost:5172/"

@dataclass
class Test:
    name: str
    method: str
    endpoint: str
    expected: int
    payload: Optional[Any] = None
    params: Optional[dict] = None
    headers: Optional[dict] = None
    result: Any = None

    def __post_init__(self): 
        return self.run()

    def run( self ):
        url = urljoin( BASE_URL, self.endpoint.lstrip( '/' ) )
        try:
            response = requests.request(
                self.method.upper(),
                url,
                json=self.payload,
                params=self.params,
                headers=self.headers,
                timeout=5
            )
            success = response.status_code == self.expected
            color = Fore.GREEN if success else Fore.RED
            symbol = "[+]" if success else "[-]"
            print(f"{color}{symbol} {self.name} → {response.status_code}" )
            self.result = {
                'name': self.name,
                'passed': success,
                'status_code': response.status_code,
                'data': response.json() if 'application/json' in response.headers.get('Content-Type', '') else response.text,
            }
            return self
        except Exception as e:
            print(f"{Fore.RED}[-] {self.name:<30} EXCEPTION: {e}")
            return {"name": self.name, "passed": False, "error": str(e)}

    def get_result( self ):
        return self.result
